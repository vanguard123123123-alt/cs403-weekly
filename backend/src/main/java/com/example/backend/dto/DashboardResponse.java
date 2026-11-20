package com.example.backend.dto;

import java.util.List;

public class DashboardResponse {

    private long totalDocuments;
    private long totalSummaries;
    private long summariesThisWeek;
    private long summariesToday;
    private int dailyLimit;
    private long visionSummariesToday;
    private int visionDailyLimit;
    private List<RecentSummaryItem> recentSummaries;
    private List<DashboardDocumentItem> documents;
    private List<WeeklyActivityItem> weeklyActivity;

    public DashboardResponse(
            long totalDocuments,
            long totalSummaries,
            long summariesThisWeek,
            long summariesToday,
            int dailyLimit,
            long visionSummariesToday,
            int visionDailyLimit,
            List<RecentSummaryItem> recentSummaries,
            List<DashboardDocumentItem> documents,
            List<WeeklyActivityItem> weeklyActivity) {
        this.totalDocuments = totalDocuments;
        this.totalSummaries = totalSummaries;
        this.summariesThisWeek = summariesThisWeek;
        this.summariesToday = summariesToday;
        this.dailyLimit = dailyLimit;
        this.visionSummariesToday = visionSummariesToday;
        this.visionDailyLimit = visionDailyLimit;
        this.recentSummaries = recentSummaries;
        this.documents = documents;
        this.weeklyActivity = weeklyActivity;
    }

    public long getTotalDocuments() {
        return totalDocuments;
    }

    public long getTotalSummaries() {
        return totalSummaries;
    }

    public long getSummariesThisWeek() {
        return summariesThisWeek;
    }

    public long getSummariesToday() {
        return summariesToday;
    }

    public int getDailyLimit() {
        return dailyLimit;
    }

    public long getVisionSummariesToday() {
        return visionSummariesToday;
    }

    public int getVisionDailyLimit() {
        return visionDailyLimit;
    }

    public List<RecentSummaryItem> getRecentSummaries() {
        return recentSummaries;
    }

    public List<DashboardDocumentItem> getDocuments() {
        return documents;
    }

    public List<WeeklyActivityItem> getWeeklyActivity() {
        return weeklyActivity;
    }
}
