const TONES = ["lavender", "peach", "blush"] as const;

export type CoverTone = (typeof TONES)[number];

// Deterministic: the same title always maps to the same tone, so a document's
// cover color never changes across reloads.
export function coverToneForTitle(title: string): CoverTone {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
    }
    return TONES[hash % TONES.length];
}
