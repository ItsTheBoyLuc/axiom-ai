/** Comparison history: the last few model sets compared in this browser (localStorage). */

export const MAX_HISTORY = 8;

export type HistoryEntry = { slugs: string[]; names: string[]; at: number };

const isEntry = (v: unknown): v is HistoryEntry =>
  typeof v === 'object' &&
  v !== null &&
  Array.isArray((v as HistoryEntry).slugs) &&
  Array.isArray((v as HistoryEntry).names) &&
  (v as HistoryEntry).slugs.every((s) => typeof s === 'string') &&
  (v as HistoryEntry).names.every((s) => typeof s === 'string') &&
  (v as HistoryEntry).slugs.length === (v as HistoryEntry).names.length &&
  (v as HistoryEntry).slugs.length >= 2 &&
  (v as HistoryEntry).slugs.length <= 4 &&
  typeof (v as HistoryEntry).at === 'number';

/** Order-independent identity of a set of models. */
export const historyKey = (slugs: string[]) => [...slugs].sort().join(',');

export function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const out: HistoryEntry[] = [];
    for (const item of data) {
      if (!isEntry(item) || seen.has(historyKey(item.slugs))) continue;
      seen.add(historyKey(item.slugs));
      out.push({ slugs: item.slugs, names: item.names, at: item.at });
      if (out.length >= MAX_HISTORY) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Newest first; the same set moves to the front instead of being duplicated. Sets of < 2 are not history. */
export function pushHistory(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  if (entry.slugs.length < 2) return list;
  return [entry, ...list.filter((e) => historyKey(e.slugs) !== historyKey(entry.slugs))].slice(
    0,
    MAX_HISTORY,
  );
}
