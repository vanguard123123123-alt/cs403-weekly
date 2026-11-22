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
// '{title} · ทั้งไฟล์'), so a round never shows up nameless.
export function summaryDisplayLabel(round: SummaryLabelLike, documentTitle: string): string {
    const trimmed = round.summaryLabel?.trim();
    return trimmed ? trimmed : `${documentTitle} · ${pageRangeLabel(round)}`;
}
