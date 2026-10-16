package com.example.backend.service;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;

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

    private final DocumentRepository documentRepository;
    private final SummaryRepository summaryRepository;
    private final List<TextExtractor> textExtractors;
    private final OpenAiService openAiService;

    public SummaryService(
            DocumentRepository documentRepository,
            SummaryRepository summaryRepository,
            List<TextExtractor> textExtractors,
            OpenAiService openAiService) {
        this.documentRepository = documentRepository;
        this.summaryRepository = summaryRepository;
        this.textExtractors = textExtractors;
        this.openAiService = openAiService;
    }

    public SummaryResponse summarizeDocument(Integer documentId, User currentUser) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException(documentId));

        if (!document.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("You do not have access to this document");
        }

        TextExtractor extractor = resolveExtractor(document.getFileType());
        String text = extractor.extractText(Path.of(document.getFilePath()));

        if (text == null || text.isBlank()) {
            throw new EmptyDocumentException("No extractable text was found in this document");
        }

        String contentSum = openAiService.summarize(text);

        Summary summary = new Summary(document, document.getTitle(), contentSum, LocalDateTime.now());

        return SummaryResponse.fromEntity(summaryRepository.save(summary));
    }

    public List<SummaryResponse> getSummariesByDocument(Integer documentId, User currentUser) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException(documentId));

        if (!document.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("You do not have access to this document");
        }

        return summaryRepository.findByDocument(document)
                .stream()
                .map(SummaryResponse::fromEntity)
                .toList();
    }

    private TextExtractor resolveExtractor(String fileType) {
        return textExtractors.stream()
                .filter(extractor -> extractor.supports(fileType))
                .findFirst()
                .orElseThrow(() -> new InvalidFileTypeException(
                        "Summarizing ." + fileType + " files is not supported yet"));
    }
}
