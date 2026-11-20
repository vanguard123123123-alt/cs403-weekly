package com.example.backend.dto;

import java.time.LocalDateTime;

public record DashboardDocumentItem(
        Integer documentId,
        String title,
        String fileType,
        Integer pageCount,
        int summaryCount,
        Integer coveredPages,
        LocalDateTime firstSummaryAt,
        LocalDateTime lastSummaryAt) {
}
