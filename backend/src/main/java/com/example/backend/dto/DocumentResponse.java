package com.example.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.example.backend.entity.Document;
import com.example.backend.util.DocumentStatsCalculator;

public class DocumentResponse {

    private Integer documentId;
    private Integer userId;
    private String title;
    private String filePath;
    private String fileType;
    private LocalDateTime uploadDate;
    private Integer pageCount;
    private int summaryCount;
    private LocalDateTime lastSummaryAt;
    private Integer coveredPages;

    public DocumentResponse(
            Integer documentId,
            Integer userId,
            String title,
            String filePath,
            String fileType,
            LocalDateTime uploadDate,
            Integer pageCount,
            int summaryCount,
            LocalDateTime lastSummaryAt,
            Integer coveredPages) {
        this.documentId = documentId;
        this.userId = userId;
        this.title = title;
        this.filePath = filePath;
        this.fileType = fileType;
        this.uploadDate = uploadDate;
        this.pageCount = pageCount;
        this.summaryCount = summaryCount;
        this.lastSummaryAt = lastSummaryAt;
        this.coveredPages = coveredPages;
    }

    // summaries must be every SummaryStatsRow belonging to this document (not just one page).
    public static DocumentResponse fromEntity(Document document, List<SummaryStatsRow> summaries) {
        return new DocumentResponse(
                document.getDocumentId(),
                document.getUser().getUserId(),
                document.getTitle(),
                document.getFilePath(),
                document.getFileType(),
                document.getUploadDate(),
                document.getPageCount(),
                summaries.size(),
                DocumentStatsCalculator.lastSummaryAt(summaries),
                DocumentStatsCalculator.coveredPages(document, summaries));
    }

    public Integer getDocumentId() {
        return documentId;
    }

    public Integer getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
    }

    public String getFilePath() {
        return filePath;
    }

    public String getFileType() {
        return fileType;
    }

    public LocalDateTime getUploadDate() {
        return uploadDate;
    }

    public Integer getPageCount() {
        return pageCount;
    }

    public int getSummaryCount() {
        return summaryCount;
    }

    public LocalDateTime getLastSummaryAt() {
        return lastSummaryAt;
    }

    public Integer getCoveredPages() {
        return coveredPages;
    }
}
