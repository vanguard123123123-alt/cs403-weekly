package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.example.backend.dto.SummarizeRequest;
import com.example.backend.dto.SummaryResponse;
import com.example.backend.entity.Document;
import com.example.backend.entity.Summary;
import com.example.backend.entity.User;
import com.example.backend.exception.ForbiddenException;
import com.example.backend.exception.InvalidSummaryLabelException;
import com.example.backend.exception.InvalidSummaryReplaceException;
import com.example.backend.exception.OpenAiException;
import com.example.backend.exception.SummaryNotFoundException;
import com.example.backend.exception.SummaryTruncatedException;
import com.example.backend.repository.SummaryRepository;

// Pure unit test: every collaborator (repository, OpenAiService, DocumentService, etc.) is a
// Mockito mock, so this test never touches a real database, the filesystem/uploads folder, or
// the real OpenAI API. It covers rename/delete ownership checks and the replaceSummaryId
// validation + "replace only on success, keep the old one on any failure" behavior in
// SummaryService in isolation from Spring and from the other services it depends on.
class SummaryServiceTest {

    private SummaryRepository summaryRepository;
    private OpenAiService openAiService;
    private DocumentService documentService;
    private TextExtractor textExtractor;
    private SummaryService summaryService;

    private User owner;
    private User otherUser;
    private Document document;

    @BeforeEach
    void setUp() {
        summaryRepository = mock(SummaryRepository.class);
        openAiService = mock(OpenAiService.class);
        UploadPathResolver uploadPathResolver = mock(UploadPathResolver.class);
        documentService = mock(DocumentService.class);
        PdfTextExtractionService pdfTextExtractionService = mock(PdfTextExtractionService.class);
        textExtractor = mock(TextExtractor.class);

        summaryService = new SummaryService(
                summaryRepository,
                List.of(textExtractor),
                openAiService,
                uploadPathResolver,
                documentService,
                pdfTextExtractionService,
                100, // dailySummaryLimit
                50_000, // maxInputChars
                25, // maxPagesPerRequest
                8, // visionMaxPages
                10); // visionDailyLimit

        owner = new User("Owner", "owner@example.com", "hash", "user");
        owner.setUserId(1);
        otherUser = new User("Other", "other@example.com", "hash", "user");
        otherUser.setUserId(2);

        document = new Document(owner, "My Document", "doc.txt", "txt", LocalDateTime.now());
        document.setDocumentId(10);

        when(documentService.getOwnedDocument(10, owner)).thenReturn(document);
        when(uploadPathResolver.resolve(any())).thenReturn(java.nio.file.Path.of("fake.txt"));
        when(textExtractor.supports("txt")).thenReturn(true);
        when(textExtractor.extractText(any(), any(), any())).thenReturn("some extracted text");
    }

    // ---- PATCH /api/summaries/{id} (rename) ----

    @Test
    void renameTrimsAndSavesValidName() {
        Summary summary = summaryOf(1, document, "old label", null, null);
        when(summaryRepository.findById(1)).thenReturn(Optional.of(summary));
        when(summaryRepository.save(any(Summary.class))).thenAnswer(inv -> inv.getArgument(0));

        SummaryResponse response = summaryService.renameSummary(1, owner, "  new name  ");

        assertEquals("new name", response.getSummaryLabel());
        verify(summaryRepository).save(summary);
    }

    @Test
    void renameRejectsEmptyAfterTrim() {
        Summary summary = summaryOf(1, document, "old label", null, null);
        when(summaryRepository.findById(1)).thenReturn(Optional.of(summary));

        assertThrows(InvalidSummaryLabelException.class, () -> summaryService.renameSummary(1, owner, "   "));
        verify(summaryRepository, never()).save(any());
    }

    @Test
    void renameRejectsNameLongerThan100Characters() {
        Summary summary = summaryOf(1, document, "old label", null, null);
        when(summaryRepository.findById(1)).thenReturn(Optional.of(summary));

        String tooLong = "a".repeat(101);
        assertThrows(InvalidSummaryLabelException.class, () -> summaryService.renameSummary(1, owner, tooLong));
        verify(summaryRepository, never()).save(any());
    }

    @Test
    void renameAcceptsExactly100Characters() {
        Summary summary = summaryOf(1, document, "old label", null, null);
        when(summaryRepository.findById(1)).thenReturn(Optional.of(summary));
        when(summaryRepository.save(any(Summary.class))).thenAnswer(inv -> inv.getArgument(0));

        String exactly100 = "a".repeat(100);
        SummaryResponse response = summaryService.renameSummary(1, owner, exactly100);

        assertEquals(exactly100, response.getSummaryLabel());
    }

    @Test
    void renameByNonOwnerIsForbidden() {
        Summary summary = summaryOf(1, document, "old label", null, null);
        when(summaryRepository.findById(1)).thenReturn(Optional.of(summary));
        when(documentService.getOwnedDocument(10, otherUser))
                .thenThrow(new ForbiddenException("You do not have access to this document"));

        assertThrows(ForbiddenException.class, () -> summaryService.renameSummary(1, otherUser, "new name"));
        verify(summaryRepository, never()).save(any());
    }

    @Test
    void renameNonExistentSummaryIsNotFound() {
        when(summaryRepository.findById(999)).thenReturn(Optional.empty());

        assertThrows(SummaryNotFoundException.class, () -> summaryService.renameSummary(999, owner, "new name"));
    }

    // ---- DELETE /api/summaries/{id} ----

    @Test
    void deleteRemovesOwnedSummary() {
        Summary summary = summaryOf(1, document, "old label", null, null);
        when(summaryRepository.findById(1)).thenReturn(Optional.of(summary));

        summaryService.deleteSummary(1, owner);

        verify(summaryRepository).delete(summary);
    }

    @Test
    void deleteByNonOwnerIsForbidden() {
        Summary summary = summaryOf(1, document, "old label", null, null);
        when(summaryRepository.findById(1)).thenReturn(Optional.of(summary));
        when(documentService.getOwnedDocument(10, otherUser))
                .thenThrow(new ForbiddenException("You do not have access to this document"));

        assertThrows(ForbiddenException.class, () -> summaryService.deleteSummary(1, otherUser));
        verify(summaryRepository, never()).delete(any(Summary.class));
    }

    @Test
    void deleteNonExistentSummaryIsNotFound() {
        when(summaryRepository.findById(999)).thenReturn(Optional.empty());

        assertThrows(SummaryNotFoundException.class, () -> summaryService.deleteSummary(999, owner));
    }

    // ---- default summary_label on a fresh (non-replace) summarize ----

    @Test
    void newSummaryGetsWholeFileDefaultLabelWhenNoPageRangeGiven() {
        when(summaryRepository.save(any(Summary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(openAiService.summarize(any())).thenReturn(new OpenAiService.CompletionResult("summary content", "stop"));

        SummaryResponse response = summaryService.summarizeDocument(10, owner, null);

        assertEquals("My Document · ทั้งไฟล์", response.getSummaryLabel());
    }

    @Test
    void defaultLabelIsTruncatedTo100Characters() {
        Document longTitleDoc = new Document(owner, "T".repeat(150), "doc.txt", "txt", LocalDateTime.now());
        longTitleDoc.setDocumentId(20);
        when(documentService.getOwnedDocument(20, owner)).thenReturn(longTitleDoc);
        when(summaryRepository.save(any(Summary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(openAiService.summarize(any())).thenReturn(new OpenAiService.CompletionResult("summary content", "stop"));

        SummaryResponse response = summaryService.summarizeDocument(20, owner, null);

        assertEquals(100, response.getSummaryLabel().length());
    }

    // ---- finish_reason="length" (OpenAI's response was cut off mid-generation) ----

    @Test
    void truncatedTextResponseIsRejectedWithoutSavingOrCountingQuota() {
        when(openAiService.summarize(any()))
                .thenReturn(new OpenAiService.CompletionResult("partial content, cut off...", "length"));

        assertThrows(SummaryTruncatedException.class, () -> summaryService.summarizeDocument(10, owner, null));

        verify(summaryRepository, never()).save(any(Summary.class));
    }

    @Test
    void truncatedVisionResponseIsRejectedWithoutSavingOrCountingQuota() {
        Document pdfDocument = new Document(owner, "My PDF Document", "doc.pdf", "pdf", LocalDateTime.now());
        pdfDocument.setDocumentId(40);
        pdfDocument.setPageCount(5);
        when(documentService.getOwnedDocument(40, owner)).thenReturn(pdfDocument);
        when(documentService.ensurePageCount(pdfDocument)).thenReturn(pdfDocument);
        when(openAiService.summarizeImages(any()))
                .thenReturn(new OpenAiService.CompletionResult("partial content, cut off...", "length"));

        SummarizeRequest request = new SummarizeRequest();
        request.setMode("vision");

        assertThrows(SummaryTruncatedException.class, () -> summaryService.summarizeDocument(40, owner, request));

        verify(summaryRepository, never()).save(any(Summary.class));
    }

    // ---- SummarizeRequest.replaceSummaryId ----

    @Test
    void replaceSuccessDeletesOldAndInheritsManuallyRenamedLabel() {
        Summary oldSummary = summaryOf(5, document, "My custom label", null, null);
        when(summaryRepository.findById(5)).thenReturn(Optional.of(oldSummary));
        when(summaryRepository.save(any(Summary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(openAiService.summarize(any())).thenReturn(new OpenAiService.CompletionResult("new content", "stop"));

        SummarizeRequest request = new SummarizeRequest();
        request.setReplaceSummaryId(5);

        SummaryResponse response = summaryService.summarizeDocument(10, owner, request);

        assertEquals("My custom label", response.getSummaryLabel());
        verify(summaryRepository).delete(oldSummary);
    }

    @Test
    void replaceSuccessUsesFreshDefaultLabelMatchingNewRangeWhenOldLabelWasNeverRenamed() {
        Document pdfDocument = new Document(owner, "My PDF Document", "doc.pdf", "pdf", LocalDateTime.now());
        pdfDocument.setDocumentId(30);
        pdfDocument.setPageCount(20);
        when(documentService.getOwnedDocument(30, owner)).thenReturn(pdfDocument);
        when(documentService.ensurePageCount(pdfDocument)).thenReturn(pdfDocument);
        when(textExtractor.supports("pdf")).thenReturn(true);
        when(textExtractor.extractText(any(), eq(5), eq(8))).thenReturn("extracted pdf text");
        when(openAiService.summarize(any())).thenReturn(new OpenAiService.CompletionResult("new content", "stop"));
        when(summaryRepository.save(any(Summary.class))).thenAnswer(inv -> inv.getArgument(0));

        // Old summary covered pages 1-3 and was left at exactly its auto-generated default
        // label, so it must NOT be inherited; the new summary gets its own default instead.
        Summary oldSummary = summaryOf(8, pdfDocument, "My PDF Document · หน้า 1-3", 1, 3);
        when(summaryRepository.findById(8)).thenReturn(Optional.of(oldSummary));

        SummarizeRequest request = new SummarizeRequest();
        request.setReplaceSummaryId(8);
        request.setStartPage(5);
        request.setEndPage(8);

        SummaryResponse response = summaryService.summarizeDocument(30, owner, request);

        assertEquals("My PDF Document · หน้า 5-8", response.getSummaryLabel());
        verify(summaryRepository).delete(oldSummary);
    }

    @Test
    void replaceDoesNotDeleteOrSaveWhenOpenAiFails() {
        Summary oldSummary = summaryOf(5, document, "My custom label", null, null);
        when(summaryRepository.findById(5)).thenReturn(Optional.of(oldSummary));
        when(openAiService.summarize(any()))
                .thenThrow(new OpenAiException("simulated failure, never a real OpenAI call", null));

        SummarizeRequest request = new SummarizeRequest();
        request.setReplaceSummaryId(5);

        assertThrows(OpenAiException.class, () -> summaryService.summarizeDocument(10, owner, request));

        verify(summaryRepository, never()).delete(any(Summary.class));
        verify(summaryRepository, never()).save(any(Summary.class));
    }

    @Test
    void replaceSummaryIdFromDifferentDocumentIsRejectedBeforeCallingOpenAi() {
        Document otherDoc = new Document(owner, "Other Document", "other.txt", "txt", LocalDateTime.now());
        otherDoc.setDocumentId(11);
        when(documentService.getOwnedDocument(11, owner)).thenReturn(otherDoc);

        Summary summaryOnOtherDoc = summaryOf(6, otherDoc, "label", null, null);
        when(summaryRepository.findById(6)).thenReturn(Optional.of(summaryOnOtherDoc));

        SummarizeRequest request = new SummarizeRequest();
        request.setReplaceSummaryId(6);

        assertThrows(InvalidSummaryReplaceException.class,
                () -> summaryService.summarizeDocument(10, owner, request));

        verifyNoInteractions(openAiService);
    }

    @Test
    void replaceSummaryIdBelongingToAnotherUsersDocumentIsForbidden() {
        Document othersDoc = new Document(otherUser, "Other's Document", "o.txt", "txt", LocalDateTime.now());
        othersDoc.setDocumentId(99);
        when(documentService.getOwnedDocument(99, owner))
                .thenThrow(new ForbiddenException("You do not have access to this document"));

        Summary summaryOnOthersDoc = summaryOf(7, othersDoc, "label", null, null);
        when(summaryRepository.findById(7)).thenReturn(Optional.of(summaryOnOthersDoc));

        SummarizeRequest request = new SummarizeRequest();
        request.setReplaceSummaryId(7);

        assertThrows(ForbiddenException.class, () -> summaryService.summarizeDocument(10, owner, request));

        verifyNoInteractions(openAiService);
    }

    @Test
    void replaceSummaryIdThatDoesNotExistIsNotFound() {
        when(summaryRepository.findById(999)).thenReturn(Optional.empty());

        SummarizeRequest request = new SummarizeRequest();
        request.setReplaceSummaryId(999);

        assertThrows(SummaryNotFoundException.class, () -> summaryService.summarizeDocument(10, owner, request));

        verifyNoInteractions(openAiService);
    }

    private Summary summaryOf(Integer id, Document doc, String label, Integer startPage, Integer endPage) {
        Summary summary = new Summary(doc, label, "content", LocalDateTime.now(), false, startPage, endPage, "text");
        summary.setSummaryId(id);
        return summary;
    }
}
