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
