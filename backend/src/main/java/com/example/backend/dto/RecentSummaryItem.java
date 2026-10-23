package com.example.backend.dto;

import java.time.LocalDateTime;

public class RecentSummaryItem {

    private Integer summaryId;
    private Integer documentId;
    private String summaryLabel;
    private LocalDateTime createdAt;
    private String contentSum;

    public RecentSummaryItem(
            Integer summaryId,
            Integer documentId,
            String summaryLabel,
            LocalDateTime createdAt,
            String contentSum) {
        this.summaryId = summaryId;
        this.documentId = documentId;
        this.summaryLabel = summaryLabel;
        this.createdAt = createdAt;
        this.contentSum = contentSum;
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getContentSum() {
        return contentSum;
    }
}
