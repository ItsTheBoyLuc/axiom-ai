import { cleanQuery } from './model';

/** Recent searches for the command palette: a short, de-duplicated list kept in localStorage. */

export const MAX_RECENT_SEARCHES = 6;

/** Parses stored JSON defensively: anything malformed yields an empty list. */
export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out: string[] = [];
    for (const item of data) {
      if (typeof item !== 'string') continue;
      const q = cleanQuery(item);
      if (q && !out.some((x) => x.toLowerCase() === q.toLowerCase())) out.push(q);
      if (out.length >= MAX_RECENT_SEARCHES) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Newest first; a repeat (any case) moves to the front instead of duplicating; capped. */
export function pushRecentSearch(list: string[], query: string): string[] {
  const q = cleanQuery(query);
  if (q.length < 2) return list; // one character is a keystroke, not a search worth remembering
  return [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(
    0,
    MAX_RECENT_SEARCHES,
  );
}
