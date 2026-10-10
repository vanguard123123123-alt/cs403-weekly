package com.example.backend.service;

import java.nio.file.Path;
import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.example.backend.dto.SummaryResponse;
import com.example.backend.entity.Document;
import com.example.backend.entity.Summary;
import com.example.backend.entity.User;
import com.example.backend.exception.DocumentNotFoundException;
import com.example.backend.exception.EmptyDocumentException;
import com.example.backend.exception.ForbiddenException;
import com.example.backend.exception.InvalidFileTypeException;
import com.example.backend.repository.DocumentRepository;
import com.example.backend.repository.SummaryRepository;

@Service
public class SummaryService {

    private static final String PDF_FILE_TYPE = "pdf";

    private final DocumentRepository documentRepository;
    private final SummaryRepository summaryRepository;
    private final PdfTextExtractionService pdfTextExtractionService;
    private final OpenAiService openAiService;

    public SummaryService(
            DocumentRepository documentRepository,
            SummaryRepository summaryRepository,
            PdfTextExtractionService pdfTextExtractionService,
            OpenAiService openAiService) {
        this.documentRepository = documentRepository;
        this.summaryRepository = summaryRepository;
        this.pdfTextExtractionService = pdfTextExtractionService;
        this.openAiService = openAiService;
    }

    public SummaryResponse summarizeDocument(Integer documentId, User currentUser) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException(documentId));

        if (!document.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("You do not have access to this document");
        }

        if (!PDF_FILE_TYPE.equalsIgnoreCase(document.getFileType())) {
            throw new InvalidFileTypeException(
                    "Summarizing images is not supported yet; only PDF files are supported");
        }

        String text = pdfTextExtractionService.extractText(Path.of(document.getFilePath()));

        if (text == null || text.isBlank()) {
            throw new EmptyDocumentException("No extractable text was found in this document");
        }

        String contentSum = openAiService.summarize(text);

        Summary summary = new Summary(document, document.getTitle(), contentSum, LocalDateTime.now());

        return SummaryResponse.fromEntity(summaryRepository.save(summary));
    }
}
