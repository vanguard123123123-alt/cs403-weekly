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

    public SummaryResponse(
            Integer summaryId,
            Integer documentId,
            String summaryLabel,
            String contentSum,
            LocalDateTime createdAt,
            boolean truncated) {
        this.summaryId = summaryId;
        this.documentId = documentId;
        this.summaryLabel = summaryLabel;
        this.contentSum = contentSum;
        this.createdAt = createdAt;
        this.truncated = truncated;
    }

    public static SummaryResponse fromEntity(Summary summary) {
        return new SummaryResponse(
                summary.getSummaryId(),
                summary.getDocument().getDocumentId(),
                summary.getSummaryLabel(),
                summary.getContentSum(),
                summary.getCreatedAt(),
                summary.isTruncated());
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
}
