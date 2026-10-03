import { NEWS_CATEGORIES, type NewsCategoryKey } from '@/types/catalog';

/**
 * URL state of `/news`: the news/research tab, search text, category, provider, source type
 * (official or independent) and page. Tolerant parsing like the other explorers: unknown or
 * malformed values are dropped, never an error.
 */

export const NEWS_PAGE_SIZE = 12;
export const FEATURED_COUNT = 3;

export const newsCategoryLabel: Record<NewsCategoryKey, string> = {
  MODEL_RELEASES: 'Model releases',
  RESEARCH: 'Research',
  COMPANIES: 'Companies',
  INFRASTRUCTURE: 'Infrastructure',
  HARDWARE: 'Hardware',
  SAFETY: 'Safety',
  REGULATION: 'Regulation',
};

/** "MODEL_RELEASES" <-> "model-releases": the form the REST API and the URL use. */
export const categorySlug = (c: NewsCategoryKey): string => c.toLowerCase().replaceAll('_', '-');
export const categoryFromSlug = (s: string | undefined): NewsCategoryKey | null =>
  NEWS_CATEGORIES.find((c) => categorySlug(c) === s) ?? null;

export const SOURCES = ['official', 'independent'] as const;
export type NewsSource = (typeof SOURCES)[number];
export const TABS = ['news', 'research'] as const;
export type NewsTab = (typeof TABS)[number];

export type NewsPageQuery = {
  tab: NewsTab;
  q: string;
  category: NewsCategoryKey | null;
  provider: string | null;
  source: NewsSource | null;
  page: number;
};

export const emptyNewsQuery: NewsPageQuery = {
  tab: 'news',
  q: '',
  category: null,
  provider: null,
  source: null,
  page: 1,
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseNewsQuery(sp: Record<string, string | string[] | undefined>): NewsPageQuery {
  const provider = first(sp.provider)?.trim();
  const source = first(sp.source);
  const page = Number(first(sp.page));
  return {
    tab: first(sp.tab) === 'research' ? 'research' : 'news',
    q: (first(sp.q) ?? '').trim().slice(0, 100),
    category: categoryFromSlug(first(sp.category)),
    provider: provider && provider.length <= 100 && SLUG.test(provider) ? provider : null,
    source: SOURCES.includes(source as NewsSource) ? (source as NewsSource) : null,
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

/** Builds `/news?...`, leaving out defaults (news tab, page 1) and empty values. */
export function newsHref(q: Partial<NewsPageQuery>): string {
  const params = new URLSearchParams();
  if (q.tab && q.tab !== 'news') params.set('tab', q.tab);
  if (q.q) params.set('q', q.q);
  if (q.category) params.set('category', categorySlug(q.category));
  if (q.provider) params.set('provider', q.provider);
  if (q.source) params.set('source', q.source);
  if (q.page && q.page > 1) params.set('page', String(q.page));
  const s = params.toString();
  return s ? `/news?${s}` : '/news';
}

/** True when any filter (not the tab or page) is active. */
export const hasNewsFilters = (q: NewsPageQuery): boolean =>
  !!(q.q || q.category || q.provider || q.source);

/** official -> true, independent -> false, none -> undefined (the repository's `official` filter). */
export const sourceFlag = (s: NewsSource | null): boolean | undefined =>
  s === null ? undefined : s === 'official';
