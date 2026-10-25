package com.example.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.example.backend.dto.SummarizeRequest;
import com.example.backend.dto.SummaryResponse;
import com.example.backend.entity.Document;
import com.example.backend.entity.Summary;
import com.example.backend.entity.User;
import com.example.backend.exception.DailySummaryLimitExceededException;
import com.example.backend.exception.DocumentNotFoundException;
import com.example.backend.exception.EmptyDocumentException;
import com.example.backend.exception.ForbiddenException;
import com.example.backend.exception.IncompleteTextException;
import com.example.backend.exception.InvalidFileTypeException;
import com.example.backend.exception.InvalidPageRangeException;
import com.example.backend.repository.DocumentRepository;
import com.example.backend.repository.SummaryRepository;
import com.example.backend.util.BangkokTime;

@Service
public class SummaryService {

    private static final Logger log = LoggerFactory.getLogger(SummaryService.class);
    private static final String PDF_FILE_TYPE = "pdf";
    private static final String MODE_TEXT = "text";
    private static final String MODE_VISION = "vision";
    private static final float VISION_RENDER_DPI = 120f;

    private final DocumentRepository documentRepository;
    private final SummaryRepository summaryRepository;
    private final List<TextExtractor> textExtractors;
    private final OpenAiService openAiService;
    private final UploadPathResolver uploadPathResolver;
    private final DocumentService documentService;
    private final PdfTextExtractionService pdfTextExtractionService;
    private final int dailySummaryLimit;
    private final int maxInputChars;
    private final int maxPagesPerRequest;
    private final int visionMaxPages;
    private final int visionDailyLimit;

    public SummaryService(
            DocumentRepository documentRepository,
            SummaryRepository summaryRepository,
            List<TextExtractor> textExtractors,
            OpenAiService openAiService,
            UploadPathResolver uploadPathResolver,
            DocumentService documentService,
            PdfTextExtractionService pdfTextExtractionService,
            @Value("${summary.daily-limit}") int dailySummaryLimit,
            @Value("${summary.max-input-chars}") int maxInputChars,
            @Value("${summary.max-pages:25}") int maxPagesPerRequest,
            @Value("${summary.vision-max-pages:8}") int visionMaxPages,
            @Value("${summary.vision-daily-limit:10}") int visionDailyLimit) {
        this.documentRepository = documentRepository;
        this.summaryRepository = summaryRepository;
        this.textExtractors = textExtractors;
        this.openAiService = openAiService;
        this.uploadPathResolver = uploadPathResolver;
        this.documentService = documentService;
        this.pdfTextExtractionService = pdfTextExtractionService;
        this.dailySummaryLimit = dailySummaryLimit;
        this.maxInputChars = maxInputChars;
        this.maxPagesPerRequest = maxPagesPerRequest;
        this.visionMaxPages = visionMaxPages;
        this.visionDailyLimit = visionDailyLimit;
    }

    public SummaryResponse summarizeDocument(Integer documentId, User currentUser, SummarizeRequest request) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new DocumentNotFoundException(documentId));

        if (!document.getUser().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("You do not have access to this document");
        }

        String requestedMode = resolveMode(request);
        Integer startPage = request != null ? request.getStartPage() : null;
        Integer endPage = request != null ? request.getEndPage() : null;

        String actualMode;
        String contentSum;
        boolean truncated = false;

        if (MODE_VISION.equals(requestedMode)) {
            enforceVisionDailyLimit(currentUser);
            document = validateVisionRange(document, startPage, endPage);
            contentSum = runVisionSummarization(document, startPage, endPage);
            actualMode = MODE_VISION;
        } else {
            enforceDailyLimit(currentUser);

            boolean hasRange = startPage != null || endPage != null;
            if (hasRange) {
                document = validatePageRange(document, startPage, endPage);
            }

            TextExtractor extractor = resolveExtractor(document.getFileType());
            String text = extractor.extractText(uploadPathResolver.resolve(document.getFilePath()), startPage, endPage);

            if (text == null || text.isBlank()) {
                if (!PDF_FILE_TYPE.equalsIgnoreCase(document.getFileType())) {
                    throw new EmptyDocumentException("No extractable text was found in this document");
                }

                log.info("Document {} produced no extractable text; auto-switching to vision mode", documentId);
                enforceVisionDailyLimit(currentUser);
                document = validateVisionRange(document, startPage, endPage);
                contentSum = runVisionSummarization(document, startPage, endPage);
                actualMode = MODE_VISION;
            } else {
                truncated = text.length() > maxInputChars;
                String textForSummary = truncated ? text.substring(0, maxInputChars) : text;

                if (truncated) {
                    log.info(
                            "Document {} text truncated from {} to {} characters before summarization",
                            documentId, text.length(), maxInputChars);
                }

                contentSum = openAiService.summarize(textForSummary);

                if (OpenAiService.isIncompleteTextResponse(contentSum)) {
                    log.info(
                            "Document {} summarization returned the incomplete-text marker; "
                                    + "rejecting without saving a summary",
                            documentId);
                    throw new IncompleteTextException();
                }

                actualMode = MODE_TEXT;
            }
        }

        Summary summary = new Summary(
                document, document.getTitle(), contentSum, LocalDateTime.now(),
                truncated, startPage, endPage, actualMode);

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

    private String runVisionSummarization(Document document, Integer startPage, Integer endPage) {
        int renderStart = startPage != null ? startPage : 1;
        int renderEnd = endPage != null ? endPage : document.getPageCount();

        List<byte[]> images = pdfTextExtractionService.renderPagesAsJpeg(
                uploadPathResolver.resolve(document.getFilePath()), renderStart, renderEnd, VISION_RENDER_DPI);

        return openAiService.summarizeImages(images);
    }

    private String resolveMode(SummarizeRequest request) {
        String rawMode = request != null ? request.getMode() : null;
        if (rawMode == null || rawMode.isBlank()) {
            return MODE_TEXT;
        }

        String normalized = rawMode.trim().toLowerCase(Locale.ROOT);
        if (!normalized.equals(MODE_TEXT) && !normalized.equals(MODE_VISION)) {
            throw new InvalidPageRangeException("mode must be either 'text' or 'vision'");
        }

        return normalized;
    }

    private Document validatePageRange(Document document, Integer startPage, Integer endPage) {
        if (!PDF_FILE_TYPE.equalsIgnoreCase(document.getFileType())) {
            throw new InvalidPageRangeException("Page ranges are only supported for PDF documents");
        }

        if (startPage == null || endPage == null) {
            throw new InvalidPageRangeException("Both startPage and endPage must be provided together");
        }

        Document withPageCount = documentService.ensurePageCount(document);
        int pageCount = withPageCount.getPageCount();

        if (startPage < 1 || endPage < startPage || endPage > pageCount) {
            throw new InvalidPageRangeException(
                    "startPage and endPage must satisfy 1 <= startPage <= endPage <= " + pageCount
                            + " (this document has " + pageCount + " pages)");
        }

        int pagesRequested = endPage - startPage + 1;
        if (pagesRequested > maxPagesPerRequest) {
            throw new InvalidPageRangeException(
                    "Requested range covers " + pagesRequested + " pages, which exceeds the limit of "
                            + maxPagesPerRequest + " pages per request");
        }

        return withPageCount;
    }

    private Document validateVisionRange(Document document, Integer startPage, Integer endPage) {
        if (!PDF_FILE_TYPE.equalsIgnoreCase(document.getFileType())) {
            throw new InvalidPageRangeException("Vision mode is only supported for PDF documents");
        }

        Document withPageCount = documentService.ensurePageCount(document);
        int pageCount = withPageCount.getPageCount();
        boolean hasRange = startPage != null || endPage != null;

        if (!hasRange) {
            if (pageCount > visionMaxPages) {
                throw new InvalidPageRangeException(
                        "Vision mode requires a page range for documents longer than " + visionMaxPages
                                + " pages. This document has " + pageCount
                                + " pages; please specify startPage and endPage.");
            }
            return withPageCount;
        }

        if (startPage == null || endPage == null) {
            throw new InvalidPageRangeException("Both startPage and endPage must be provided together");
        }

        if (startPage < 1 || endPage < startPage || endPage > pageCount) {
            throw new InvalidPageRangeException(
                    "startPage and endPage must satisfy 1 <= startPage <= endPage <= " + pageCount
                            + " (this document has " + pageCount + " pages)");
        }

        int pagesRequested = endPage - startPage + 1;
        if (pagesRequested > visionMaxPages) {
            throw new InvalidPageRangeException(
                    "Requested range covers " + pagesRequested
                            + " pages, which exceeds the vision mode limit of "
                            + visionMaxPages + " pages per request");
        }

        return withPageCount;
    }

    private void enforceDailyLimit(User currentUser) {
        long countToday = summaryRepository.countByDocument_UserAndCreatedAtGreaterThanEqual(
                currentUser, BangkokTime.startOfToday());

        if (countToday >= dailySummaryLimit) {
            throw new DailySummaryLimitExceededException(dailySummaryLimit);
        }
    }

    private void enforceVisionDailyLimit(User currentUser) {
        long countToday = summaryRepository.countByDocument_UserAndModeAndCreatedAtGreaterThanEqual(
                currentUser, MODE_VISION, BangkokTime.startOfToday());

        if (countToday >= visionDailyLimit) {
            throw new DailySummaryLimitExceededException(visionDailyLimit, MODE_VISION);
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
