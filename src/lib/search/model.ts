import { SEARCH_TYPES, type SearchHit, type SearchResults, type SearchType } from '@/types/catalog';

/**
 * Shared pieces of global search (the palette and `/search`): labels, the order results are
 * shown in, URL building and the rules for what counts as an external link. Pure.
 */

export const searchTypeLabel: Record<SearchType, string> = {
  models: 'Models',
  providers: 'Providers',
  benchmarks: 'Benchmarks',
  releases: 'Releases',
  news: 'News',
  research: 'Research',
};

/** Where each type's own search lives, for "view all" links (benchmarks have no text search page). */
export const typeSearchHref: Partial<Record<SearchType, (q: string) => string>> = {
  models: (q) => `/models?q=${encodeURIComponent(q)}`,
  providers: (q) => `/providers?q=${encodeURIComponent(q)}`,
  releases: (q) => `/releases?q=${encodeURIComponent(q)}`,
  news: (q) => `/news?q=${encodeURIComponent(q)}`,
  research: (q) => `/news?tab=research&q=${encodeURIComponent(q)}`,
};

export const MAX_QUERY_LENGTH = 100;

/** The search text as the API sees it: trimmed and capped. */
export const cleanQuery = (q: string): string => q.trim().slice(0, MAX_QUERY_LENGTH);

/** `/search?q=...&types=...` (types omitted when all are searched). */
export function searchHref(q: string, types: readonly SearchType[] = []): string {
  const params = new URLSearchParams();
  const text = cleanQuery(q);
  if (text) params.set('q', text);
  if (types.length > 0 && types.length < SEARCH_TYPES.length) params.set('types', types.join(','));
  const s = params.toString();
  return s ? `/search?${s}` : '/search';
}

/** Parses `types` from a URL: valid, unique, in canonical order; empty means "all". */
export function parseTypes(raw: string | string[] | undefined): SearchType[] {
  const text = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
  const wanted = new Set(text.split(',').map((s) => s.trim()));
  return SEARCH_TYPES.filter((t) => wanted.has(t));
}

/** News and research hits link to the outside world; everything else is an internal path. */
export const isExternalHref = (href: string): boolean => /^https?:\/\//i.test(href);

export type HitGroup = { type: SearchType; label: string; hits: SearchHit[] };

/** Non-empty result groups in the canonical type order. */
export function groupHits(results: SearchResults['results']): HitGroup[] {
  return SEARCH_TYPES.filter((t) => (results[t]?.length ?? 0) > 0).map((t) => ({
    type: t,
    label: searchTypeLabel[t],
    hits: results[t]!,
  }));
}

export const totalHits = (results: SearchResults['results']): number =>
  SEARCH_TYPES.reduce((n, t) => n + (results[t]?.length ?? 0), 0);
