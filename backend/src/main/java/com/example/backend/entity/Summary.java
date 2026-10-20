package com.example.backend.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "summaries")
public class Summary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "summary_id")
    private Integer summaryId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @Column(name = "summary_label", nullable = false, length = 225)
    private String summaryLabel;

    @Column(name = "content_sum", nullable = false, columnDefinition = "TEXT")
    private String contentSum;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "truncated", nullable = false)
    private boolean truncated;

    public Summary() {
    }

    public Summary(
            Document document,
            String summaryLabel,
            String contentSum,
            LocalDateTime createdAt,
            boolean truncated) {
        this.document = document;
        this.summaryLabel = summaryLabel;
        this.contentSum = contentSum;
        this.createdAt = createdAt;
        this.truncated = truncated;
    }

    public Integer getSummaryId() {
        return summaryId;
    }

    public void setSummaryId(Integer summaryId) {
        this.summaryId = summaryId;
    }

    public Document getDocument() {
        return document;
    }

    public void setDocument(Document document) {
        this.document = document;
    }

    public String getSummaryLabel() {
        return summaryLabel;
    }

    public void setSummaryLabel(String summaryLabel) {
        this.summaryLabel = summaryLabel;
    }

    public String getContentSum() {
        return contentSum;
    }

    public void setContentSum(String contentSum) {
        this.contentSum = contentSum;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public boolean isTruncated() {
        return truncated;
    }

    public void setTruncated(boolean truncated) {
        this.truncated = truncated;
    }
}
