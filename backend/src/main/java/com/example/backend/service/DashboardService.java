package com.example.backend.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.example.backend.dto.DashboardDocumentItem;
import com.example.backend.dto.DashboardResponse;
import com.example.backend.dto.RecentSummaryItem;
import com.example.backend.dto.SummaryStatsRow;
import com.example.backend.dto.WeeklyActivityItem;
import com.example.backend.entity.Document;
import com.example.backend.entity.User;
import com.example.backend.repository.DocumentRepository;
import com.example.backend.repository.SummaryRepository;
import com.example.backend.util.BangkokTime;
import com.example.backend.util.DocumentStatsCalculator;

@Service
public class DashboardService {

    private static final int RECENT_SUMMARY_LIMIT = 5;
    private static final int CONTENT_PREVIEW_LENGTH = 150;
    private static final int WEEKLY_ACTIVITY_WEEKS = 8;
    private static final String MODE_VISION = "vision";

    private final DocumentRepository documentRepository;
    private final SummaryRepository summaryRepository;
    private final DocumentService documentService;
    private final int dailySummaryLimit;
    private final int visionDailyLimit;

    public DashboardService(
            DocumentRepository documentRepository,
            SummaryRepository summaryRepository,
            DocumentService documentService,
            @Value("${summary.daily-limit}") int dailySummaryLimit,
            @Value("${summary.vision-daily-limit:10}") int visionDailyLimit) {
        this.documentRepository = documentRepository;
        this.summaryRepository = summaryRepository;
        this.documentService = documentService;
        this.dailySummaryLimit = dailySummaryLimit;
        this.visionDailyLimit = visionDailyLimit;
    }

    public DashboardResponse getDashboard(User user) {
        long totalDocuments = documentRepository.countByUser(user);
        long totalSummaries = summaryRepository.countByDocument_User(user);
        long summariesToday = summaryRepository.countByDocument_UserAndCreatedAtGreaterThanEqual(
                user, BangkokTime.startOfToday());
        long visionSummariesToday = summaryRepository.countByDocument_UserAndModeAndCreatedAtGreaterThanEqual(
                user, MODE_VISION, BangkokTime.startOfToday());

        List<RecentSummaryItem> recentSummaries = summaryRepository
                .findRecentByUser(user, PageRequest.of(0, RECENT_SUMMARY_LIMIT))
                .stream()
                .map(this::withTruncatedContent)
                .toList();

        // One query for every summary of this user's documents; everything below is
        // grouped in memory instead of issuing a query per document or per week.
        List<SummaryStatsRow> stats = summaryRepository.findStatsByUser(user);
        Map<Integer, List<SummaryStatsRow>> statsByDocument = stats.stream()
                .collect(Collectors.groupingBy(SummaryStatsRow::documentId));

        List<Document> documents = documentRepository.findByUser(user)
                .stream()
                .map(documentService::ensurePageCount)
                .toList();

        List<DashboardDocumentItem> documentItems = documents.stream()
                .map(document -> toDocumentItem(
                        document, statsByDocument.getOrDefault(document.getDocumentId(), List.of())))
                .toList();

        LocalDate thisWeekStart = BangkokTime.currentWeekStart();
        long summariesThisWeek = stats.stream()
                .filter(row -> !row.createdAt().isBefore(thisWeekStart.atStartOfDay()))
                .count();

        List<WeeklyActivityItem> weeklyActivity = buildWeeklyActivity(stats, thisWeekStart);

        return new DashboardResponse(
                totalDocuments,
                totalSummaries,
                summariesThisWeek,
                summariesToday,
                dailySummaryLimit,
                visionSummariesToday,
                visionDailyLimit,
                recentSummaries,
                documentItems,
                weeklyActivity);
    }

    private DashboardDocumentItem toDocumentItem(Document document, List<SummaryStatsRow> docStats) {
        return new DashboardDocumentItem(
                document.getDocumentId(),
                document.getTitle(),
                document.getFileType(),
                document.getPageCount(),
                docStats.size(),
                DocumentStatsCalculator.coveredPages(document, docStats),
                DocumentStatsCalculator.firstSummaryAt(docStats),
                DocumentStatsCalculator.lastSummaryAt(docStats));
    }

    private List<WeeklyActivityItem> buildWeeklyActivity(List<SummaryStatsRow> stats, LocalDate thisWeekStart) {
        Map<LocalDate, Long> countsByWeek = stats.stream()
                .collect(Collectors.groupingBy(
                        row -> BangkokTime.mondayOf(row.createdAt().toLocalDate()),
                        Collectors.counting()));

        return IntStream.range(0, WEEKLY_ACTIVITY_WEEKS)
                .mapToObj(i -> thisWeekStart.minusWeeks(WEEKLY_ACTIVITY_WEEKS - 1L - i))
                .map(weekStart -> new WeeklyActivityItem(
                        weekStart.format(DateTimeFormatter.ISO_LOCAL_DATE),
                        countsByWeek.getOrDefault(weekStart, 0L)))
                .toList();
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
