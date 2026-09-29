import { latestBenchmarkResult } from '../../src/lib/models/benchmarks';
import {
  CAPABILITIES,
  CATEGORIES,
  DEPLOYMENTS,
  PRICING_KINDS,
  capabilityLabel,
  categoryLabel,
  deploymentLabel,
  pricingKindLabel,
  type FacetOption,
  type ModelFacets,
  type ModelListItem,
  type ModelListResult,
  type ModelQuery,
  type ModelSuggestion,
} from '../../src/types/model';

/**
 * Pure directory logic (search, filter, sort, paginate, facets). The demo repository runs it
 * in memory; the Prisma repository (Phase 3) implements the same contract in SQL.
 * Semantics: OR within a filter group, AND across groups.
 */

type Dimension = 'provider' | 'category' | 'capability' | 'deployment' | 'pricing';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');

const tokens = (q: string) => norm(q).split(/\s+/).filter(Boolean);

/**
 * Relevance of a model to a search string. Every token must match somewhere (name, family,
 * provider, description, capabilities, categories); 0 means no match.
 */
export function searchScore(m: ModelListItem, q: string): number {
  const toks = tokens(q);
  if (toks.length === 0) return 1;
  const fields: [string, number][] = [
    [norm(m.name), 4],
    [norm(m.family), 3],
    [norm(m.providerName), 3],
    [norm(m.capabilities.map((c) => capabilityLabel[c]).join(' ')), 2],
    [norm(m.categories.map((c) => categoryLabel[c]).join(' ')), 2],
    [norm(m.description), 1],
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

const DIMENSIONS: Dimension[] = ['provider', 'category', 'capability', 'deployment', 'pricing'];

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

const byName = (a: ModelListItem, b: ModelListItem) => a.name.localeCompare(b.name);

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

  switch (query.sort) {
    case 'alpha':
      return out.sort(byName);
    case 'provider':
      return out.sort((a, b) => a.providerName.localeCompare(b.providerName) || byName(a, b));
    case 'updated':
      return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || byName(a, b));
    case 'context':
      return out.sort(numericDesc((m) => m.contextWindow));
    case 'benchmark': {
      const slug = query.benchmark;
      if (!slug)
        return out.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || byName(a, b));
      return out.sort(numericDesc((m) => latestBenchmarkResult(m.benchmarks, slug)?.score ?? null));
    }
    case 'recent':
    default:
      return out.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || byName(a, b));
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
    .sort((a, b) => a[1].localeCompare(b[1]))
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

/** Full directory result: filter, sort, paginate (page is clamped into range) and facets. */
export function listModels(all: ModelListItem[], query: ModelQuery): ModelListResult {
  const filtered = sortModels(filterModels(all, query), query);
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * query.pageSize;
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

/** Top suggestions for the search box, best match first. */
export function suggestModels(all: ModelListItem[], q: string, limit = 6): ModelSuggestion[] {
  if (tokens(q).length === 0) return [];
  return all
    .map((m) => ({ m, score: searchScore(m, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || byName(a.m, b.m))
    .slice(0, limit)
    .map(({ m }) => ({
      slug: m.slug,
      name: m.name,
      providerName: m.providerName,
      family: m.family,
      isDemo: m.isDemo,
    }));
}

/** Related models: same provider and/or overlapping categories and capabilities. */
export function relatedModels(all: ModelListItem[], slug: string, limit = 3): ModelListItem[] {
  const self = all.find((m) => m.slug === slug);
  if (!self) return [];
  const score = (m: ModelListItem) =>
    (m.providerSlug === self.providerSlug ? 3 : 0) +
    m.categories.filter((c) => self.categories.includes(c)).length * 2 +
    m.capabilities.filter((c) => self.capabilities.includes(c)).length;
  return all
    .filter((m) => m.slug !== slug)
    .map((m) => ({ m, s: score(m) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || byName(a.m, b.m))
    .slice(0, limit)
    .map((x) => x.m);
}
