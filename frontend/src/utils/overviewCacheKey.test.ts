import { describe, expect, it } from "vitest";
import { overviewCacheKey } from "./overviewCacheKey";

describe("overviewCacheKey", () => {
    it("sorts ids ascending", () => {
        expect(overviewCacheKey([3, 1, 2])).toBe("1,2,3");
    });

    it("gives the same key for the same set ticked in a different order", () => {
        expect(overviewCacheKey([5, 7, 2])).toBe(overviewCacheKey([7, 2, 5]));
    });

    it("gives different keys for different sets", () => {
        expect(overviewCacheKey([1, 2, 3])).not.toBe(overviewCacheKey([1, 2, 4]));
        expect(overviewCacheKey([1, 2])).not.toBe(overviewCacheKey([1, 2, 3]));
    });

    it("gives an empty-string key for an empty set", () => {
        expect(overviewCacheKey([])).toBe("");
    });
});
