import { describe, expect, it } from "vitest";
import { summaryDisplayLabel, uncoveredPagesLabel } from "./roundFormatting";

describe("summaryDisplayLabel", () => {
    it("falls back to title + page range when summaryLabel is null", () => {
        const round = { summaryLabel: null, startPage: 5, endPage: 10 };
        expect(summaryDisplayLabel(round, "My Document")).toBe("My Document · หน้า 5-10");
    });

    it("falls back to title + page range when summaryLabel is an empty string", () => {
        const round = { summaryLabel: "", startPage: 5, endPage: 10 };
        expect(summaryDisplayLabel(round, "My Document")).toBe("My Document · หน้า 5-10");
    });

    it("falls back to title + page range when summaryLabel is whitespace only", () => {
        const round = { summaryLabel: "    ", startPage: 5, endPage: 10 };
        expect(summaryDisplayLabel(round, "My Document")).toBe("My Document · หน้า 5-10");
    });

    it("falls back when summaryLabel is exactly the document title", () => {
        const round = { summaryLabel: "My Document", startPage: 5, endPage: 10 };
        expect(summaryDisplayLabel(round, "My Document")).toBe("My Document · หน้า 5-10");
    });

    it("falls back when summaryLabel is the document title with surrounding whitespace", () => {
        const round = { summaryLabel: "  My Document  ", startPage: 5, endPage: 10 };
        expect(summaryDisplayLabel(round, "  My Document  ")).toBe("My Document · หน้า 5-10");
    });

    it("uses the custom label when it differs from the document title", () => {
        const round = { summaryLabel: "Chapter 1 recap", startPage: 5, endPage: 10 };
        expect(summaryDisplayLabel(round, "My Document")).toBe("Chapter 1 recap");
    });

    it("trims a custom label before displaying it", () => {
        const round = { summaryLabel: "  Chapter 1 recap  ", startPage: 5, endPage: 10 };
        expect(summaryDisplayLabel(round, "My Document")).toBe("Chapter 1 recap");
    });

    it("falls back to title + ทั้งไฟล์ for a whole-file summary with no custom label", () => {
        const round = { summaryLabel: null, startPage: null, endPage: null };
        expect(summaryDisplayLabel(round, "My Document")).toBe("My Document · ทั้งไฟล์");
    });

    it("keeps a custom label for a whole-file summary", () => {
        const round = { summaryLabel: "Full overview", startPage: null, endPage: null };
        expect(summaryDisplayLabel(round, "My Document")).toBe("Full overview");
    });
});

describe("uncoveredPagesLabel", () => {
    it("is null when there are no gaps", () => {
        expect(uncoveredPagesLabel([])).toBeNull();
    });

    it("formats a single multi-page gap", () => {
        expect(uncoveredPagesLabel([{ start: 1, end: 3 }])).toBe("หน้า 1-3");
    });

    it("formats a single-page gap without a dash", () => {
        expect(uncoveredPagesLabel([{ start: 5, end: 5 }])).toBe("หน้า 5");
    });

    it("joins several gaps with commas", () => {
        expect(
            uncoveredPagesLabel([
                { start: 1, end: 3 },
                { start: 9, end: 10 },
            ])
        ).toBe("หน้า 1-3, 9-10");
    });
});
