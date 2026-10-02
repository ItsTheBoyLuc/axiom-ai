import { latestBenchmarkResult } from '../../src/lib/models/benchmarks';
import { compareKeys, normalizeText, searchTokens, sortKey } from '../../src/lib/text';
import {
  CAPABILITIES,
  CATEGORIES,
  DEPLOYMENTS,
  PRICING_KINDS,
  capabilityLabel,
  categoryLabel,
  deploymentLabel,
  pricingKindLabel,
  type Capability,
  type Category,
  type FacetOption,
  type ModelFacets,
  type ModelListItem,
  type ModelListResult,
  type ModelQuery,
  type ModelSuggestion,
} from '../../src/types/model';

/**
 * Pure directory logic (search, filter, sort, paginate, facets). The in-memory reference
 * implementation (used by tests) runs it directly; the Prisma repository reimplements the same
 * contract in SQL and is checked against this one by parity tests.
 * Semantics: OR within a filter group, AND across groups.
 */

export type Dimension = 'provider' | 'category' | 'capability' | 'deployment' | 'pricing';

/** The fields search looks at. ModelListItem satisfies this, so does a slim DB row. */
export type SearchFields = {
  name: string;
  family: string;
  providerName: string;
  description: string;
  capabilities: Capability[];
  categories: Category[];
};

/**
 * The normalised text blob used for substring search: one line per field, so a token (which
 * never contains whitespace) can only match inside a single field. The database stores exactly
 * this string in Model.searchDocument.
 */
export function buildSearchDocumentText(m: SearchFields): string {
  return [
    m.name,
    m.family,
    m.providerName,
    m.capabilities.map((c) => capabilityLabel[c]).join(' '),
    m.categories.map((c) => categoryLabel[c]).join(' '),
    m.description,
  ]
    .map(normalizeText)
    .join('\n');
}

/**
 * Relevance of a model to a search string. Every token must match somewhere (name, family,
 * provider, description, capabilities, categories); 0 means no match.
 */
export function searchScore(m: SearchFields, q: string): number {
  const toks = searchTokens(q);
  if (toks.length === 0) return 1;
  const fields: [string, number][] = [
    [normalizeText(m.name), 4],
    [normalizeText(m.family), 3],
    [normalizeText(m.providerName), 3],
    [normalizeText(m.capabilities.map((c) => capabilityLabel[c]).join(' ')), 2],
    [normalizeText(m.categories.map((c) => categoryLabel[c]).join(' ')), 2],
    [normalizeText(m.description), 1],
  ];
  let score = 0;
  for (const t of toks) {
    let best = 0;
    for (const [text, weight] of fields) if (text.includes(t)) best = Math.max(best, weight);
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

function matchesDimension(m: ModelListItem, query: ModelQuery, dim: Dimension): boolean {
  switch (dim) {
    case 'provider':
      return (
        query.provider.length === 0 ||
        query.provider.some((p) =>
          p === 'other' ? m.providerTier === 'other' : p === m.providerSlug,
        )
      );
    case 'category':
      return query.category.length === 0 || query.category.some((c) => m.categories.includes(c));
    case 'capability':
      return (
        query.capability.length === 0 || query.capability.some((c) => m.capabilities.includes(c))
      );
    case 'deployment':
      return (
        query.deployment.length === 0 || query.deployment.some((d) => m.deployment.includes(d))
      );
    case 'pricing':
      return query.pricing.length === 0 || query.pricing.includes(m.pricingKind);
  }
}

export const DIMENSIONS: Dimension[] = [
  'provider',
  'category',
  'capability',
  'deployment',
  'pricing',
];

/** Applies search + all filter groups, optionally skipping one group (used for facet counts). */
export function filterModels(
  all: ModelListItem[],
  query: ModelQuery,
  skip?: Dimension,
): ModelListItem[] {
  return all.filter(
    (m) =>
      searchScore(m, query.q) > 0 &&
      DIMENSIONS.every((d) => d === skip || matchesDimension(m, query, d)),
  );
}

/** Name order used everywhere: normalised name by code point, then slug (fully deterministic). */
export const byName = (a: { name: string; slug: string }, b: { name: string; slug: string }) =>
  compareKeys(sortKey(a.name), sortKey(b.name)) || compareKeys(a.slug, b.slug);

/** Sorts a copy. There is deliberately no "overall" / relevance-blended ranking. */
export function sortModels(items: ModelListItem[], query: ModelQuery): ModelListItem[] {
  const out = [...items];
  // Nulls last for numeric sorts, ties broken by name for stable, predictable order.
  const numericDesc =
    (get: (m: ModelListItem) => number | null) => (a: ModelListItem, b: ModelListItem) => {
      const x = get(a);
      const y = get(b);
      if (x === null && y === null) return byName(a, b);
      if (x === null) return 1;
      if (y === null) return -1;
      return y - x || byName(a, b);
    };
  const newestFirst = (a: ModelListItem, b: ModelListItem) =>
    compareKeys(b.releaseDate, a.releaseDate) || byName(a, b);

  switch (query.sort) {
    case 'alpha':
      return out.sort(byName);
    case 'provider':
      return out.sort(
        (a, b) => compareKeys(sortKey(a.providerName), sortKey(b.providerName)) || byName(a, b),
      );
    case 'updated':
      return out.sort((a, b) => compareKeys(b.updatedAt, a.updatedAt) || byName(a, b));
    case 'context':
      return out.sort(numericDesc((m) => m.contextWindow));
    case 'benchmark': {
      const slug = query.benchmark;
      if (!slug) return out.sort(newestFirst);
      return out.sort(numericDesc((m) => latestBenchmarkResult(m.benchmarks, slug)?.score ?? null));
    }
    case 'recent':
    default:
      return out.sort(newestFirst);
  }
}

/** Facet options with counts, each computed with its own group's filter removed. */
export function buildFacets(all: ModelListItem[], query: ModelQuery): ModelFacets {
  const count = (dim: Dimension, test: (m: ModelListItem) => boolean) =>
    filterModels(all, query, dim).filter(test).length;

  const listedProviders = new Map<string, string>();
  let hasOther = false;
  for (const m of all) {
    if (m.providerTier === 'listed') listedProviders.set(m.providerSlug, m.providerName);
    else hasOther = true;
  }
  const provider: FacetOption[] = [...listedProviders.entries()]
    .sort((a, b) => compareKeys(sortKey(a[1]), sortKey(b[1])))
    .map(([value, label]) => ({
      value,
      label,
      count: count('provider', (m) => m.providerSlug === value),
    }));
  if (hasOther) {
    provider.push({
      value: 'other',
      label: 'Other',
      count: count('provider', (m) => m.providerTier === 'other'),
    });
  }

  return {
    provider,
    category: CATEGORIES.map((v) => ({
      value: v,
      label: categoryLabel[v],
      count: count('category', (m) => m.categories.includes(v)),
    })),
    capability: CAPABILITIES.map((v) => ({
      value: v,
      label: capabilityLabel[v],
      count: count('capability', (m) => m.capabilities.includes(v)),
    })),
    deployment: DEPLOYMENTS.map((v) => ({
      value: v,
      label: deploymentLabel[v],
      count: count('deployment', (m) => m.deployment.includes(v)),
    })),
    pricing: PRICING_KINDS.map((v) => ({
      value: v,
      label: pricingKindLabel[v],
      count: count('pricing', (m) => m.pricingKind === v),
    })),
  };
}

/** Clamps a page number into range and returns the slice bounds. */
export function paginate(total: number, page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(1, page), pageCount);
  return { pageCount, page: clamped, start: (clamped - 1) * pageSize };
}

/** Full directory result: filter, sort, paginate (page is clamped into range) and facets. */
export function listModels(all: ModelListItem[], query: ModelQuery): ModelListResult {
  const filtered = sortModels(filterModels(all, query), query);
  const total = filtered.length;
  const { pageCount, page, start } = paginate(total, query.page, query.pageSize);
  const items = filtered.slice(start, start + query.pageSize);
  return {
    items,
    total,
    page,
    pageSize: query.pageSize,
    pageCount,
    facets: buildFacets(all, query),
    hasDemo: items.some((m) => m.isDemo),
  };
}

/** Orders search hits: best match first, then name. Shared by every suggest implementation. */
export function rankSuggestions<T extends SearchFields & { slug: string }>(
  rows: T[],
  q: string,
  limit: number,
): T[] {
  return rows
    .map((m) => ({ m, score: searchScore(m, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || byName(a.m, b.m))
    .slice(0, limit)
    .map((x) => x.m);
}

/** Top suggestions for the search box, best match first. */
export function suggestModels(all: ModelListItem[], q: string, limit = 6): ModelSuggestion[] {
  if (searchTokens(q).length === 0) return [];
  return rankSuggestions(all, q, limit).map((m) => ({
    slug: m.slug,
    name: m.name,
    providerName: m.providerName,
    family: m.family,
    isDemo: m.isDemo,
  }));
}

export type RelatedFields = {
  slug: string;
  name: string;
  providerSlug: string;
  categories: Category[];
  capabilities: Capability[];
};

/** Related-model score: same provider, plus overlapping categories and capabilities. */
export function relatedScore(self: RelatedFields, m: RelatedFields): number {
  return (
    (m.providerSlug === self.providerSlug ? 3 : 0) +
    m.categories.filter((c) => self.categories.includes(c)).length * 2 +
    m.capabilities.filter((c) => self.capabilities.includes(c)).length
  );
}

/** Ranks candidates by related score (ties by name) and returns the top `limit`. */
export function rankRelated<T extends RelatedFields>(
  self: RelatedFields,
  all: T[],
  limit: number,
): T[] {
  return all
    .filter((m) => m.slug !== self.slug)
    .map((m) => ({ m, s: relatedScore(self, m) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || byName(a.m, b.m))
    .slice(0, limit)
    .map((x) => x.m);
}

/** Related models: same provider and/or overlapping categories and capabilities. */
export function relatedModels(all: ModelListItem[], slug: string, limit = 3): ModelListItem[] {
  const self = all.find((m) => m.slug === slug);
  if (!self) return [];
  return rankRelated(self, all, limit);
}
