import type { PageRange } from "./pageRangeMerger";

interface PageRangeLike {
    startPage: number | null;
    endPage: number | null;
}

export function pageRangeLabel(round: PageRangeLike): string {
    if (round.startPage == null || round.endPage == null) {
        return "ทั้งไฟล์";
    }
    return `หน้า ${round.startPage}-${round.endPage}`;
}

export function formatDateTime(value: string): string {
    return new Date(value).toLocaleString("th-TH");
}

interface SummaryLabelLike extends PageRangeLike {
    summaryLabel?: string | null;
}

// The name shown for a summary: its summaryLabel when set, otherwise the same
// fallback the backend uses as the default label ('{title} · หน้า a-b' or
// '{title} · ทั้งไฟล์'), so a round never shows up nameless. A label that is
// just the bare document title (older summaries stored this before per-round
// labels existed) is treated the same as "no label" so rounds still read as
// distinct from each other via their page range.
export function summaryDisplayLabel(round: SummaryLabelLike, documentTitle: string): string {
    const trimmedTitle = documentTitle.trim();
    const trimmedLabel = round.summaryLabel?.trim();
    const hasCustomLabel = !!trimmedLabel && trimmedLabel !== trimmedTitle;
    return hasCustomLabel ? trimmedLabel! : `${trimmedTitle} · ${pageRangeLabel(round)}`;
}

// Thai label for the gaps returned by uncoveredPageRanges, e.g. "หน้า 1-3, 9-10".
// null means there are no gaps at all (fully covered, or no page count to begin with).
export function uncoveredPagesLabel(ranges: PageRange[]): string | null {
    if (ranges.length === 0) {
        return null;
    }
    const parts = ranges.map((range) => (range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`));
    return `หน้า ${parts.join(", ")}`;
}
