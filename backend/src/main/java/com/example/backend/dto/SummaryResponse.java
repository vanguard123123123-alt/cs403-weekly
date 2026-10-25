package com.example.backend.dto;

import java.time.LocalDateTime;

import com.example.backend.entity.Summary;

public class SummaryResponse {

    private Integer summaryId;
    private Integer documentId;
    private String summaryLabel;
    private String contentSum;
    private LocalDateTime createdAt;
    private boolean truncated;
    private Integer startPage;
    private Integer endPage;
    private String mode;

    public SummaryResponse(
            Integer summaryId,
            Integer documentId,
            String summaryLabel,
            String contentSum,
            LocalDateTime createdAt,
            boolean truncated,
            Integer startPage,
            Integer endPage,
            String mode) {
        this.summaryId = summaryId;
        this.documentId = documentId;
        this.summaryLabel = summaryLabel;
        this.contentSum = contentSum;
        this.createdAt = createdAt;
        this.truncated = truncated;
        this.startPage = startPage;
        this.endPage = endPage;
        this.mode = mode;
    }

    public static SummaryResponse fromEntity(Summary summary) {
        return new SummaryResponse(
                summary.getSummaryId(),
                summary.getDocument().getDocumentId(),
                summary.getSummaryLabel(),
                summary.getContentSum(),
                summary.getCreatedAt(),
                summary.isTruncated(),
                summary.getStartPage(),
                summary.getEndPage(),
                summary.getMode());
    }

    public Integer getSummaryId() {
        return summaryId;
    }

    public Integer getDocumentId() {
        return documentId;
    }

    public String getSummaryLabel() {
        return summaryLabel;
    }

    public String getContentSum() {
        return contentSum;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public boolean isTruncated() {
        return truncated;
    }

    public Integer getStartPage() {
        return startPage;
    }

    public Integer getEndPage() {
        return endPage;
    }

    public String getMode() {
        return mode;
    }
}
