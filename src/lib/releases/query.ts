import { RELEASE_KINDS, type ReleaseKind } from '@/types/model';
import type { ReleaseItem } from '@/types/catalog';

/**
 * URL state of `/releases`: search text, provider, release kind, evaluation date range, view
 * (timeline or list) and page. Parsing is tolerant like the other explorers: unknown or
 * malformed values are dropped, an inverted date range is swapped.
 */

export const RELEASES_PAGE_SIZE = 20;
export const VIEWS = ['timeline', 'list'] as const;
export type ReleasesView = (typeof VIEWS)[number];

export type ReleasesQuery = {
  q: string;
  provider: string | null;
  category: ReleaseKind | null;
  from: string | null;
  to: string | null;
  view: ReleasesView;
  page: number;
};

export const emptyReleasesQuery: ReleasesQuery = {
  q: '',
  provider: null,
  category: null,
  from: null,
  to: null,
  view: 'timeline',
  page: 1,
};

/** "API_CHANGE" <-> "api-change": the form the REST API and the URL use. */
export const kindSlug = (k: ReleaseKind): string => k.toLowerCase().replaceAll('_', '-');
export const kindFromSlug = (s: string | undefined): ReleaseKind | null =>
  RELEASE_KINDS.find((k) => kindSlug(k) === s) ?? null;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_Q = 100;
const MAX_PAGE = 10_000;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function date(v: string | string[] | undefined): string | null {
  const s = first(v)?.trim();
  if (!s || !DATE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

export function parseReleasesQuery(
  sp: Record<string, string | string[] | undefined>,
): ReleasesQuery {
  const provider = first(sp.provider)?.trim();
  let from = date(sp.from);
  let to = date(sp.to);
  if (from && to && from > to) [from, to] = [to, from];
  const page = Number(first(sp.page));
  return {
    q: (first(sp.q) ?? '').trim().slice(0, MAX_Q),
    provider: provider && SLUG.test(provider) && provider.length <= 100 ? provider : null,
    category: kindFromSlug(first(sp.category)),
    from,
    to,
    view: first(sp.view) === 'list' ? 'list' : 'timeline',
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
  };
}

/** Builds `/releases?...`, leaving out defaults (timeline view, page 1) and empty values. */
export function releasesHref(q: Partial<ReleasesQuery>): string {
  const params = new URLSearchParams();
  if (q.q) params.set('q', q.q);
  if (q.provider) params.set('provider', q.provider);
  if (q.category) params.set('category', kindSlug(q.category));
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.view && q.view !== 'timeline') params.set('view', q.view);
  if (q.page && q.page > 1) params.set('page', String(q.page));
  const s = params.toString();
  return s ? `/releases?${s}` : '/releases';
}

export const hasReleaseFilters = (q: ReleasesQuery): boolean =>
  !!(q.q || q.provider || q.category || q.from || q.to);

// ------------------------------------------------------------- grouping

export type MonthGroup = { key: string; label: string; items: ReleaseItem[] };

/** Groups (already newest-first) releases under month headings, keeping their order. */
export function groupByMonth(items: ReleaseItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const r of items) {
    const key = r.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = {
        key,
        label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        items: [],
      };
      groups.push(g);
    }
    g.items.push(r);
  }
  return groups;
}
