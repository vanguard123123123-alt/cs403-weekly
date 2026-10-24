export function stripMarkdown(markdown: string): string {
    return markdown
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/(\*\*|__)(.*?)\1/g, "$2")
        .replace(/(\*|_)(.*?)\1/g, "$2")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^>\s+/gm, "")
        .replace(/^[\s]*[-*+]\s+/gm, "")
        .replace(/^[\s]*\d+\.\s+/gm, "")
        .replace(/\s+/g, " ")
        .trim();
}
