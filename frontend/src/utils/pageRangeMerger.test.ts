import { describe, expect, it } from "vitest";
import { coveredPagesForSummaries, countCoveredPages, mergeRanges } from "./pageRangeMerger";

describe("mergeRanges / countCoveredPages", () => {
    it("merges duplicate ranges", () => {
        const merged = mergeRanges([
            { start: 1, end: 5 },
            { start: 1, end: 5 },
        ]);
        expect(merged).toEqual([{ start: 1, end: 5 }]);
        expect(countCoveredPages(merged)).toBe(5);
    });

    it("merges partially overlapping ranges", () => {
        const merged = mergeRanges([
            { start: 1, end: 5 },
            { start: 3, end: 8 },
        ]);
        expect(merged).toEqual([{ start: 1, end: 8 }]);
        expect(countCoveredPages(merged)).toBe(8);
    });

    it("merges directly adjacent ranges", () => {
        const merged = mergeRanges([
            { start: 1, end: 5 },
            { start: 6, end: 10 },
        ]);
        expect(merged).toEqual([{ start: 1, end: 10 }]);
        expect(countCoveredPages(merged)).toBe(10);
    });

    it("keeps non-adjacent ranges separate", () => {
        const merged = mergeRanges([
            { start: 10, end: 12 },
            { start: 1, end: 3 },
        ]);
        expect(merged).toEqual([
            { start: 1, end: 3 },
            { start: 10, end: 12 },
        ]);
        expect(countCoveredPages(merged)).toBe(6);
    });

    it("returns no coverage for an empty input", () => {
        expect(mergeRanges([])).toEqual([]);
        expect(countCoveredPages([])).toBe(0);
    });
});

describe("coveredPagesForSummaries", () => {
    it("is null when the page count is unknown (e.g. a TXT file)", () => {
        expect(coveredPagesForSummaries([{ startPage: 1, endPage: 3 }], null)).toBeNull();
    });

    it("is 0 when there are no summaries yet", () => {
        expect(coveredPagesForSummaries([], 10)).toBe(0);
    });

    it("treats a null startPage/endPage as covering the whole file", () => {
        expect(coveredPagesForSummaries([{ startPage: null, endPage: null }], 12)).toBe(12);
        expect(coveredPagesForSummaries([{ startPage: null, endPage: 5 }], 12)).toBe(12);
        expect(coveredPagesForSummaries([{ startPage: 5, endPage: null }], 12)).toBe(12);
    });

    it("merges duplicate/overlapping/adjacent ranges across summaries", () => {
        expect(
            coveredPagesForSummaries(
                [
                    { startPage: 1, endPage: 5 },
                    { startPage: 1, endPage: 5 },
                    { startPage: 3, endPage: 8 },
                    { startPage: 9, endPage: 12 },
                ],
                20
            )
        ).toBe(12);
    });
});
