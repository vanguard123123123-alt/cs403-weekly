package com.example.backend.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.example.backend.dto.SummaryStatsRow;
import com.example.backend.entity.Document;

class DocumentStatsCalculatorTest {

    private Document pdfDocument(Integer pageCount) {
        Document document = new Document();
        document.setFileType("pdf");
        document.setPageCount(pageCount);
        return document;
    }

    private SummaryStatsRow row(Integer startPage, Integer endPage) {
        return new SummaryStatsRow(1, startPage, endPage, LocalDateTime.now());
    }

    @Test
    void coveredPagesIsNullWhenPageCountUnknown() {
        Document document = pdfDocument(null);

        assertNull(DocumentStatsCalculator.coveredPages(document, List.of(row(1, 3))));
    }

    @Test
    void coveredPagesIsNullForTxtFiles() {
        Document document = new Document();
        document.setFileType("txt");
        document.setPageCount(5); // should never happen in practice, but the file type alone must force null

        assertNull(DocumentStatsCalculator.coveredPages(document, List.of(row(1, 3))));
    }

    @Test
    void coveredPagesIsZeroWithNoSummaries() {
        Document document = pdfDocument(10);

        assertEquals(0, DocumentStatsCalculator.coveredPages(document, List.of()));
    }

    @Test
    void nullStartOrEndPageCoversWholeFile() {
        Document document = pdfDocument(12);

        assertEquals(12, DocumentStatsCalculator.coveredPages(document, List.of(row(null, null))));
        assertEquals(12, DocumentStatsCalculator.coveredPages(document, List.of(row(null, 5))));
        assertEquals(12, DocumentStatsCalculator.coveredPages(document, List.of(row(5, null))));
    }

    @Test
    void duplicateRangesCountOnce() {
        Document document = pdfDocument(20);

        assertEquals(5, DocumentStatsCalculator.coveredPages(document, List.of(row(1, 5), row(1, 5))));
    }

    @Test
    void partiallyOverlappingRangesMerge() {
        Document document = pdfDocument(20);

        assertEquals(8, DocumentStatsCalculator.coveredPages(document, List.of(row(1, 5), row(3, 8))));
    }

    @Test
    void adjacentRangesMerge() {
        Document document = pdfDocument(20);

        assertEquals(10, DocumentStatsCalculator.coveredPages(document, List.of(row(1, 5), row(6, 10))));
    }

    @Test
    void firstAndLastSummaryAtPickExtremes() {
        LocalDateTime earliest = LocalDateTime.of(2026, 1, 1, 9, 0);
        LocalDateTime middle = LocalDateTime.of(2026, 1, 5, 9, 0);
        LocalDateTime latest = LocalDateTime.of(2026, 1, 10, 9, 0);

        List<SummaryStatsRow> summaries = List.of(
                new SummaryStatsRow(1, null, null, middle),
                new SummaryStatsRow(1, null, null, latest),
                new SummaryStatsRow(1, null, null, earliest));

        assertEquals(earliest, DocumentStatsCalculator.firstSummaryAt(summaries));
        assertEquals(latest, DocumentStatsCalculator.lastSummaryAt(summaries));
    }

    @Test
    void firstAndLastSummaryAtAreNullWithoutSummaries() {
        assertNull(DocumentStatsCalculator.firstSummaryAt(List.of()));
        assertNull(DocumentStatsCalculator.lastSummaryAt(List.of()));
    }
}
