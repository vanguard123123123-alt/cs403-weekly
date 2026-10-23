package com.example.backend.dto;

import java.util.List;

public class DashboardResponse {

    private long totalDocuments;
    private long totalSummaries;
    private long summariesToday;
    private int dailyLimit;
    private List<RecentSummaryItem> recentSummaries;

    public DashboardResponse(
            long totalDocuments,
            long totalSummaries,
            long summariesToday,
            int dailyLimit,
            List<RecentSummaryItem> recentSummaries) {
        this.totalDocuments = totalDocuments;
        this.totalSummaries = totalSummaries;
        this.summariesToday = summariesToday;
        this.dailyLimit = dailyLimit;
        this.recentSummaries = recentSummaries;
    }

    public long getTotalDocuments() {
        return totalDocuments;
    }

    public long getTotalSummaries() {
        return totalSummaries;
    }

    public long getSummariesToday() {
        return summariesToday;
    }

    public int getDailyLimit() {
        return dailyLimit;
    }

    public List<RecentSummaryItem> getRecentSummaries() {
        return recentSummaries;
    }
}
