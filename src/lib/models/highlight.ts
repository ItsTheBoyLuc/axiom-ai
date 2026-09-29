export type HighlightPart = { text: string; match: boolean };

/**
 * Splits `text` into parts, marking the pieces that match any whitespace-separated token of
 * `query` (case-insensitive). Pure and React-free so it can be unit tested.
 */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const tokens = [...new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean))];
  if (tokens.length === 0) return [{ text, match: false }];
  const escaped = tokens
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text
    .split(re)
    .filter((p) => p !== '')
    .map((p) => ({ text: p, match: tokens.includes(p.toLowerCase()) }));
}
