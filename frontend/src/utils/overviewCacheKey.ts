// Cache key for a ticked set of summary ids: sorted ascending so the key is the
// same regardless of the order the checkboxes were ticked in, and joined into one
// string so it can be used as a Map key.
export function overviewCacheKey(summaryIds: number[]): string {
    return [...summaryIds].sort((a, b) => a - b).join(",");
}
