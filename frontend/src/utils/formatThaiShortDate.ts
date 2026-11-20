const THAI_SHORT_MONTHS = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
];

// Parses a plain "yyyy-MM-dd" string directly instead of going through `Date`,
// so the displayed day never shifts because of the viewer's local timezone.
export function formatThaiShortDate(isoDate: string): string {
    const [, month, day] = isoDate.split("-").map(Number);
    return `${day} ${THAI_SHORT_MONTHS[month - 1]}`;
}
