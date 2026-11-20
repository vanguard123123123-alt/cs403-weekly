package com.example.backend.util;

import java.util.ArrayList;
import java.util.List;

public final class PageRangeMerger {

    private PageRangeMerger() {
    }

    public record PageRange(int start, int end) {
        public PageRange {
            if (start > end) {
                throw new IllegalArgumentException("start (" + start + ") must be <= end (" + end + ")");
            }
        }
    }

    // Merges overlapping and directly adjacent ranges (e.g. [1,5] and [6,10] become [1,10]);
    // a gap of one page or more keeps them separate.
    public static List<PageRange> merge(List<PageRange> ranges) {
        List<PageRange> sorted = ranges.stream()
                .sorted((a, b) -> Integer.compare(a.start(), b.start()))
                .toList();

        List<PageRange> merged = new ArrayList<>();
        for (PageRange range : sorted) {
            if (!merged.isEmpty() && range.start() <= merged.get(merged.size() - 1).end() + 1) {
                PageRange last = merged.remove(merged.size() - 1);
                merged.add(new PageRange(last.start(), Math.max(last.end(), range.end())));
            } else {
                merged.add(range);
            }
        }
        return merged;
    }

    public static int countCoveredPages(List<PageRange> ranges) {
        return merge(ranges).stream().mapToInt(r -> r.end() - r.start() + 1).sum();
    }
}
