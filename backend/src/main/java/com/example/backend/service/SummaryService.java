package com.example.backend.service;

import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.example.backend.dto.SummaryResponse;
import com.example.backend.entity.Document;
import com.example.backend.entity.Summary;
import com.example.backend.entity.User;
import com.example.backend.exception.DailySummaryLimitExceededException;
import com.example.backend.exception.DocumentNotFoundException;
import com.example.backend.exception.EmptyDocumentException;
import com.example.backend.exception.ForbiddenException;
import com.example.backend.exception.InvalidFileTypeException;
import com.example.backend.repository.DocumentRepository;
import com.example.backend.repository.SummaryRepository;
import com.example.backend.util.BangkokTime;

@Service
public class SummaryService {

    private static final Logger log = LoggerFactory.getLogger(SummaryService.class);

    private final DocumentRepository documentRepository;
    private final SummaryRepository summaryRepository;
    private final List<TextExtractor> textExtractors;
    private final OpenAiService openAiService;
    private final UploadPathResolver uploadPathResolver;
    private final int dailySummaryLimit;
    private final int maxInputChars;

    public SummaryService(
            DocumentRepository documentRepository,
            SummaryRepository summaryRepository,
            List<TextExtractor> textExtractors,
            OpenAiService openAiService,
            UploadPathResolver uploadPathResolver,
            @Value("${summary.daily-limit}") int dailySummaryLimit,
            @Value("${summary.max-input-chars}") int maxInputChars) {
        this.documentRepository = documentRepository;
        this.summaryRepository = summaryRepository;
        this.textExtractors = textExtractors;
        this.openAiService = openAiService;
        this.uploadPathResolver = uploadPathResolver;
        this.dailySummaryLimit = dailySummaryLimit;
        this.maxInputChars = maxInputChars;
    }

    public SummaryResponse summarizeDocument(Integer documentId, User currentUser) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException(documentId));

        if (!document.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("You do not have access to this document");
        }

        enforceDailyLimit(currentUser);

        TextExtractor extractor = resolveExtractor(document.getFileType());
        String text = extractor.extractText(uploadPathResolver.resolve(document.getFilePath()));

        if (text == null || text.isBlank()) {
            throw new EmptyDocumentException("No extractable text was found in this document");
        }

        boolean truncated = text.length() > maxInputChars;
        String textForSummary = truncated ? text.substring(0, maxInputChars) : text;

        if (truncated) {
            log.info(
                    "Document {} text truncated from {} to {} characters before summarization",
                    documentId, text.length(), maxInputChars);
        }

        String contentSum = openAiService.summarize(textForSummary);

        Summary summary = new Summary(document, document.getTitle(), contentSum, LocalDateTime.now(), truncated);

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

    private void enforceDailyLimit(User currentUser) {
        long countToday = summaryRepository.countByDocument_UserAndCreatedAtGreaterThanEqual(
                currentUser, BangkokTime.startOfToday());

        if (countToday >= dailySummaryLimit) {
            throw new DailySummaryLimitExceededException(dailySummaryLimit);
        }
    }

    private TextExtractor resolveExtractor(String fileType) {
        return textExtractors.stream()
                .filter(extractor -> extractor.supports(fileType))
                .findFirst()
                .orElseThrow(() -> new InvalidFileTypeException(
                        "Summarizing ." + fileType + " files is not supported yet"));
    }
}
