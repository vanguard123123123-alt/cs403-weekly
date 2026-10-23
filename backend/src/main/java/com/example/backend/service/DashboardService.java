package com.example.backend.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.example.backend.dto.DashboardResponse;
import com.example.backend.dto.RecentSummaryItem;
import com.example.backend.entity.User;
import com.example.backend.repository.DocumentRepository;
import com.example.backend.repository.SummaryRepository;
import com.example.backend.util.BangkokTime;

@Service
public class DashboardService {

    private static final int RECENT_SUMMARY_LIMIT = 5;
    private static final int CONTENT_PREVIEW_LENGTH = 150;

    private final DocumentRepository documentRepository;
    private final SummaryRepository summaryRepository;
    private final int dailySummaryLimit;

    public DashboardService(
            DocumentRepository documentRepository,
            SummaryRepository summaryRepository,
            @Value("${summary.daily-limit}") int dailySummaryLimit) {
        this.documentRepository = documentRepository;
        this.summaryRepository = summaryRepository;
        this.dailySummaryLimit = dailySummaryLimit;
    }

    public DashboardResponse getDashboard(User user) {
        long totalDocuments = documentRepository.countByUser(user);
        long totalSummaries = summaryRepository.countByDocument_User(user);
        long summariesToday = summaryRepository.countByDocument_UserAndCreatedAtGreaterThanEqual(
                user, BangkokTime.startOfToday());

        List<RecentSummaryItem> recentSummaries = summaryRepository
                .findRecentByUser(user, PageRequest.of(0, RECENT_SUMMARY_LIMIT))
                .stream()
                .map(this::withTruncatedContent)
                .toList();

        return new DashboardResponse(totalDocuments, totalSummaries, summariesToday, dailySummaryLimit, recentSummaries);
    }

    private RecentSummaryItem withTruncatedContent(RecentSummaryItem item) {
        String content = item.getContentSum();
        String preview = content.length() > CONTENT_PREVIEW_LENGTH
                ? content.substring(0, CONTENT_PREVIEW_LENGTH)
                : content;

        return new RecentSummaryItem(
                item.getSummaryId(),
                item.getDocumentId(),
                item.getSummaryLabel(),
                item.getCreatedAt(),
                preview);
    }
}
