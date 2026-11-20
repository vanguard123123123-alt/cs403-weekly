package com.example.backend.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.example.backend.util.PageRangeMerger.PageRange;

class PageRangeMergerTest {

    @Test
    void duplicateRangesMergeToOne() {
        List<PageRange> merged = PageRangeMerger.merge(List.of(
                new PageRange(1, 5),
                new PageRange(1, 5)));

        assertEquals(List.of(new PageRange(1, 5)), merged);
        assertEquals(5, PageRangeMerger.countCoveredPages(merged));
    }

    @Test
    void partiallyOverlappingRangesMerge() {
        List<PageRange> merged = PageRangeMerger.merge(List.of(
                new PageRange(1, 5),
                new PageRange(3, 8)));

        assertEquals(List.of(new PageRange(1, 8)), merged);
        assertEquals(8, PageRangeMerger.countCoveredPages(merged));
    }

    @Test
    void adjacentRangesMerge() {
        List<PageRange> merged = PageRangeMerger.merge(List.of(
                new PageRange(1, 5),
                new PageRange(6, 10)));

        assertEquals(List.of(new PageRange(1, 10)), merged);
        assertEquals(10, PageRangeMerger.countCoveredPages(merged));
    }

    @Test
    void nonAdjacentRangesStaySeparate() {
        List<PageRange> merged = PageRangeMerger.merge(List.of(
                new PageRange(10, 12),
                new PageRange(1, 3)));

        assertEquals(List.of(new PageRange(1, 3), new PageRange(10, 12)), merged);
        assertEquals(6, PageRangeMerger.countCoveredPages(merged));
    }

    @Test
    void multipleOverlapsCollapseIntoOneRange() {
        List<PageRange> merged = PageRangeMerger.merge(List.of(
                new PageRange(5, 9),
                new PageRange(1, 2),
                new PageRange(2, 6),
                new PageRange(8, 15)));

        assertEquals(List.of(new PageRange(1, 15)), merged);
        assertEquals(15, PageRangeMerger.countCoveredPages(merged));
    }

    @Test
    void emptyInputProducesNoCoverage() {
        List<PageRange> merged = PageRangeMerger.merge(List.of());

        assertEquals(List.of(), merged);
        assertEquals(0, PageRangeMerger.countCoveredPages(merged));
    }
}
