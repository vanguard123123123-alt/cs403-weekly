package com.example.backend.dto;

import java.time.LocalDateTime;

// Projection used to fetch only what's needed to compute per-document and
// per-week statistics for a whole user in a single query (avoids N+1).
public record SummaryStatsRow(Integer documentId, Integer startPage, Integer endPage, LocalDateTime createdAt) {
}
