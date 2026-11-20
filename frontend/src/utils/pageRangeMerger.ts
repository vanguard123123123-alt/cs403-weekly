// Mirrors the backend's PageRangeMerger/DocumentStatsCalculator (same merge rule:
// overlapping and directly adjacent ranges combine), so the frontend can compute
// "unique pages covered" for an arbitrary subset of summaries without another API call.

export interface PageRange {
    start: number;
    end: number;
}

export function mergeRanges(ranges: PageRange[]): PageRange[] {
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged: PageRange[] = [];

    for (const range of sorted) {
        const last = merged[merged.length - 1];
        if (last && range.start <= last.end + 1) {
            last.end = Math.max(last.end, range.end);
        } else {
            merged.push({ ...range });
        }
    }

    return merged;
}

export function countCoveredPages(ranges: PageRange[]): number {
    return mergeRanges(ranges).reduce((sum, range) => sum + (range.end - range.start + 1), 0);
}

export interface SummaryPageRange {
    startPage: number | null;
    endPage: number | null;
}

// null startPage/endPage means that summary covered the whole file.
// Returns null when coverage can't be computed (unknown page count, e.g. a TXT file).
export function coveredPagesForSummaries(
    summaries: SummaryPageRange[],
    pageCount: number | null
): number | null {
    if (pageCount == null) {
        return null;
    }

    const coversWholeFile = summaries.some((s) => s.startPage == null || s.endPage == null);
    if (coversWholeFile) {
        return pageCount;
    }

    if (summaries.length === 0) {
        return 0;
    }

    return countCoveredPages(
        summaries.map((s) => ({ start: s.startPage as number, end: s.endPage as number }))
    );
}
