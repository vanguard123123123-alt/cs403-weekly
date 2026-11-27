package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.example.backend.dto.OverviewRequest;
import com.example.backend.dto.OverviewResponse;
import com.example.backend.entity.Document;
import com.example.backend.entity.Summary;
import com.example.backend.entity.User;
import com.example.backend.exception.ForbiddenException;
import com.example.backend.exception.InvalidOverviewRequestException;
import com.example.backend.exception.OpenAiException;
import com.example.backend.exception.OverviewDailyLimitExceededException;
import com.example.backend.exception.OverviewGenerationException;
import com.example.backend.exception.SummaryNotFoundException;

// Pure unit test: DocumentService, SummaryService, OpenAiService and UsageLogService are all
// Mockito mocks, so this never touches a real database, the uploads folder, or the real OpenAI
// API. maxChars is set low (1000) on purpose so "exceeds max-chars" is easy to trigger with
// short in-memory strings instead of needing a real 30,000-character fixture.
class OverviewServiceTest {

    private static final int MAX_ITEMS = 12;
    private static final int MAX_CHARS = 1000;
    private static final int DAILY_LIMIT = 5;

    private DocumentService documentService;
    private SummaryService summaryService;
    private OpenAiService openAiService;
    private UsageLogService usageLogService;
    private OverviewService overviewService;

    private User owner;
    private Document document;

    @BeforeEach
    void setUp() {
        documentService = mock(DocumentService.class);
        summaryService = mock(SummaryService.class);
        openAiService = mock(OpenAiService.class);
        usageLogService = mock(UsageLogService.class);

        overviewService = new OverviewService(
                documentService, summaryService, openAiService, usageLogService,
                MAX_ITEMS, MAX_CHARS, DAILY_LIMIT);

        owner = new User("Owner", "owner@example.com", "hash", "user");
        owner.setUserId(1);

        document = new Document(owner, "My Document", "doc.pdf", "pdf", LocalDateTime.now());
        document.setDocumentId(10);

        when(documentService.getOwnedDocument(10, owner)).thenReturn(document);
        when(usageLogService.countToday(1, "overview")).thenReturn(0L);
    }

    private Summary summaryOf(Integer id, Document doc, String label, String content) {
        Summary summary = new Summary(doc, label, content, LocalDateTime.now(), false, null, null, "text");
        summary.setSummaryId(id);
        return summary;
    }

    private static String validAiJson(String overviewMarkdown) {
        return "{\"overviewMarkdown\":\"" + overviewMarkdown.replace("\"", "\\\"").replace("\n", "\\n") + "\"}";
    }

    @Test
    void happyPathReturnsParsedOverview() {
        Summary s1 = summaryOf(1, document, "Chapter 1", "content one");
        Summary s2 = summaryOf(2, document, "Chapter 2", "content two");
        when(summaryService.getOwnedSummary(1, owner)).thenReturn(s1);
        when(summaryService.getOwnedSummary(2, owner)).thenReturn(s2);
        when(openAiService.generateOverview(any(), any()))
                .thenReturn(validAiJson("## ภาพรวมที่เรียนมา\nเนื้อหา"));

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(1, 2));

        OverviewResponse response = overviewService.generateOverview(10, owner, request);

        assertTrue(response.getOverviewMarkdown().contains("ภาพรวมที่เรียนมา"));
        verify(usageLogService).recordUsage(1, "overview");
    }

    // Guards the "frontend must not break on an old cached shape" requirement from the
    // backend side: ignoreUnknown means a stale AI response that still includes the old
    // practiceTopics field (e.g. a model that hasn't picked up the new schema yet) must
    // still parse instead of throwing OverviewGenerationException.
    @Test
    void aiResponseWithLeftoverPracticeTopicsFieldStillParses() {
        Summary s1 = summaryOf(1, document, "Chapter 1", "content");
        when(summaryService.getOwnedSummary(1, owner)).thenReturn(s1);
        when(openAiService.generateOverview(any(), any()))
                .thenReturn("{\"overviewMarkdown\":\"## ภาพรวมที่เรียนมา\\nเนื้อหา\","
                        + "\"practiceTopics\":[\"หัวข้อ A\"]}");

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(1));

        OverviewResponse response = overviewService.generateOverview(10, owner, request);

        assertTrue(response.getOverviewMarkdown().contains("ภาพรวมที่เรียนมา"));
    }

    @Test
    void summaryIdFromAnotherDocumentIsRejectedWith400() {
        Document otherDoc = new Document(owner, "Other Document", "o.pdf", "pdf", LocalDateTime.now());
        otherDoc.setDocumentId(99);
        Summary summaryOnOtherDoc = summaryOf(5, otherDoc, "label", "content");
        when(summaryService.getOwnedSummary(5, owner)).thenReturn(summaryOnOtherDoc);

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(5));

        assertThrows(InvalidOverviewRequestException.class,
                () -> overviewService.generateOverview(10, owner, request));
        verifyNoInteractions(openAiService);
        verify(usageLogService, never()).recordUsage(anyInt(), any());
    }

    @Test
    void summaryBelongingToAnotherUserIsForbiddenWith403() {
        when(summaryService.getOwnedSummary(5, owner))
                .thenThrow(new ForbiddenException("You do not have access to this document"));

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(5));

        assertThrows(ForbiddenException.class, () -> overviewService.generateOverview(10, owner, request));
        verifyNoInteractions(openAiService);
        verify(usageLogService, never()).recordUsage(anyInt(), any());
    }

    @Test
    void nonExistentSummaryIsNotFoundWith404() {
        when(summaryService.getOwnedSummary(999, owner)).thenThrow(new SummaryNotFoundException(999));

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(999));

        assertThrows(SummaryNotFoundException.class, () -> overviewService.generateOverview(10, owner, request));
        verifyNoInteractions(openAiService);
        verify(usageLogService, never()).recordUsage(anyInt(), any());
    }

    @Test
    void moreThanMaxItemsIsRejectedWith400() {
        List<Integer> tooMany = java.util.stream.IntStream.rangeClosed(1, MAX_ITEMS + 1).boxed().toList();

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(tooMany);

        assertThrows(InvalidOverviewRequestException.class,
                () -> overviewService.generateOverview(10, owner, request));
        verifyNoInteractions(summaryService);
        verifyNoInteractions(openAiService);
        verify(usageLogService, never()).recordUsage(anyInt(), any());
    }

    @Test
    void emptySummaryIdsIsRejectedWith400() {
        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of());

        assertThrows(InvalidOverviewRequestException.class,
                () -> overviewService.generateOverview(10, owner, request));
        verifyNoInteractions(openAiService);
    }

    @Test
    void combinedContentExceedingMaxCharsIsRejectedWith400AndNeverTruncatedSilently() {
        Summary s1 = summaryOf(1, document, "Chapter 1", "a".repeat(600));
        Summary s2 = summaryOf(2, document, "Chapter 2", "b".repeat(600));
        when(summaryService.getOwnedSummary(1, owner)).thenReturn(s1);
        when(summaryService.getOwnedSummary(2, owner)).thenReturn(s2);

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(1, 2));

        assertThrows(InvalidOverviewRequestException.class,
                () -> overviewService.generateOverview(10, owner, request));
        verifyNoInteractions(openAiService);
        verify(usageLogService, never()).recordUsage(anyInt(), any());
    }

    @Test
    void exceedingDailyQuotaIsRejectedWith429BeforeCallingOpenAi() {
        when(usageLogService.countToday(1, "overview")).thenReturn((long) DAILY_LIMIT);
        Summary s1 = summaryOf(1, document, "Chapter 1", "content");
        when(summaryService.getOwnedSummary(1, owner)).thenReturn(s1);

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(1));

        assertThrows(OverviewDailyLimitExceededException.class,
                () -> overviewService.generateOverview(10, owner, request));
        verifyNoInteractions(openAiService);
        verify(usageLogService, never()).recordUsage(anyInt(), any());
    }

    @Test
    void usageRowIsStillRecordedWhenOpenAiCallFailsAfterwards() {
        Summary s1 = summaryOf(1, document, "Chapter 1", "content");
        when(summaryService.getOwnedSummary(1, owner)).thenReturn(s1);
        when(openAiService.generateOverview(any(), any()))
                .thenThrow(new OpenAiException("simulated failure, never a real OpenAI call", null));

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(1));

        assertThrows(OpenAiException.class, () -> overviewService.generateOverview(10, owner, request));

        // The usage row is written (via the separate REQUIRES_NEW transaction) before the
        // OpenAI call, so it must still have been recorded even though the call then failed.
        verify(usageLogService).recordUsage(1, "overview");
    }

    @Test
    void urlsAndMarkdownLinksAreStrippedFromOverviewMarkdown() {
        Summary s1 = summaryOf(1, document, "Chapter 1", "content");
        when(summaryService.getOwnedSummary(1, owner)).thenReturn(s1);
        String overviewWithLinks = "## ภาพรวมที่เรียนมา\nดูเพิ่มเติมที่ [เว็บไซต์](https://example.com/page) "
                + "หรือ https://example.com/raw และ www.example.org";
        when(openAiService.generateOverview(any(), any())).thenReturn(validAiJson(overviewWithLinks));

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(1));

        OverviewResponse response = overviewService.generateOverview(10, owner, request);

        assertTrue(response.getOverviewMarkdown().contains("เว็บไซต์"));
        assertTrue(!response.getOverviewMarkdown().contains("http"));
        assertTrue(!response.getOverviewMarkdown().contains("www."));
    }

    @Test
    void malformedJsonFromAiIsRejectedWith502() {
        Summary s1 = summaryOf(1, document, "Chapter 1", "content");
        when(summaryService.getOwnedSummary(1, owner)).thenReturn(s1);
        when(openAiService.generateOverview(any(), any())).thenReturn("this is not valid JSON at all");

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(1));

        assertThrows(OverviewGenerationException.class, () -> overviewService.generateOverview(10, owner, request));
        // The usage row was already recorded before the (failed) parse attempt.
        verify(usageLogService).recordUsage(1, "overview");
    }

    @Test
    void documentNotOwnedByUserFailsBeforeAnySummaryLookup() {
        when(documentService.getOwnedDocument(eq(10), any()))
                .thenThrow(new ForbiddenException("You do not have access to this document"));

        OverviewRequest request = new OverviewRequest();
        request.setSummaryIds(List.of(1));

        assertThrows(ForbiddenException.class, () -> overviewService.generateOverview(10, owner, request));
        verifyNoInteractions(summaryService);
        verifyNoInteractions(openAiService);
    }
}
