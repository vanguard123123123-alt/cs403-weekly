package com.example.backend.util;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import com.example.backend.dto.SummaryStatsRow;
import com.example.backend.entity.Document;

public final class DocumentStatsCalculator {

    private static final String PDF_FILE_TYPE = "pdf";

    private DocumentStatsCalculator() {
    }

    // Number of distinct pages covered by at least one summary, or null when
    // coverage can't be computed (unknown page count, or a non-paginated file type).
    public static Integer coveredPages(Document document, List<SummaryStatsRow> summaries) {
        if (document.getPageCount() == null || !PDF_FILE_TYPE.equalsIgnoreCase(document.getFileType())) {
            return null;
        }

        boolean coversWholeFile = summaries.stream()
                .anyMatch(s -> s.startPage() == null || s.endPage() == null);
        if (coversWholeFile) {
            return document.getPageCount();
        }

        List<PageRangeMerger.PageRange> ranges = summaries.stream()
                .map(s -> new PageRangeMerger.PageRange(s.startPage(), s.endPage()))
                .toList();
        return PageRangeMerger.countCoveredPages(ranges);
    }

    public static LocalDateTime firstSummaryAt(List<SummaryStatsRow> summaries) {
        return summaries.stream().map(SummaryStatsRow::createdAt).min(Comparator.naturalOrder()).orElse(null);
    }

    public static LocalDateTime lastSummaryAt(List<SummaryStatsRow> summaries) {
        return summaries.stream().map(SummaryStatsRow::createdAt).max(Comparator.naturalOrder()).orElse(null);
    }
}
