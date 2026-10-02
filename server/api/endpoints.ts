import { z } from 'zod';
import type { SearchType } from '../../src/types/catalog';
import type { Repositories } from '../repositories';
import { getStats } from '../services/stats';
import { compareCsv } from './compare-csv';
import { ApiError, notFound, type CachePolicy } from './http';
import {
  benchmarkResultRowSchema,
  benchmarkSummarySchema,
  errorSchema,
  healthSchema,
  list,
  modelDetailSchema,
  modelListItemSchema,
  modelSuggestionSchema,
  modelsPage,
  newsItemSchema,
  one,
  paged,
  benchmarkResultSchema,
  pricingEntrySchema,
  providerDetailSchema,
  providerSummarySchema,
  releaseHistoryEntrySchema,
  releaseItemSchema,
  searchResultsSchema,
  statsSchema,
} from './response-schemas';
import {
  benchmarkResultsQuerySchema,
  compareQuerySchema,
  modelsQuerySchema,
  newsQuerySchema,
  providersQuerySchema,
  relatedQuerySchema,
  releasesQuerySchema,
  searchQuerySchema,
  slugParams,
  suggestQuerySchema,
} from './schemas';

/**
 * The read API (docs/PROMPT.md 10), declared once. Route files serve these definitions and
 * the OpenAPI document is generated from them, so behaviour and documentation cannot drift.
 * Paths are relative to /api/v1.
 */

export type HandlerCtx = {
  /** Parsed, validated query (typed per endpoint by the cast helpers below). */
  query: unknown;
  params: unknown;
  repos: Repositories;
  request: Request;
};

export type Endpoint = {
  id: string;
  method: 'GET';
  path: string;
  summary: string;
  description?: string;
  tag: string;
  query?: z.ZodType;
  params?: z.ZodType;
  response: z.ZodType;
  /** Error statuses this endpoint can return, in addition to 400 for invalid input. */
  errors?: number[];
  contentType?: string;
  /** Redis cache config; null = never cached in Redis. */
  cache: {
    ttlSeconds: number;
    tags: (ctx: { query: unknown; params: unknown }) => string[];
  } | null;
  /** CDN/browser Cache-Control policy for successful responses. */
  policy: CachePolicy | 'no-store';
  /**
   * Returns the response body (JSON object, or a string for text/csv). Absent for endpoints
   * that are implemented elsewhere and only documented here (health).
   */
  handler?: (ctx: HandlerCtx) => Promise<unknown>;
  /** Extra response headers computed from the request context (e.g. Content-Disposition). */
  headers?: (ctx: { query: unknown; params: unknown }) => Record<string, string>;
};

const READ: CachePolicy = { maxAge: 60, swr: 300 };
const DETAIL: CachePolicy = { maxAge: 300, swr: 600 };

const q = <T>(ctx: HandlerCtx) => ctx.query as T;
const p = <T>(ctx: HandlerCtx) => ctx.params as T;
type Slug = { slug: string };

const pageMeta = (r: { page: number; pageSize: number; total: number; pageCount: number }) => ({
  page: r.page,
  pageSize: r.pageSize,
  total: r.total,
  pageCount: r.pageCount,
});

async function requireModel(repos: Repositories, slug: string) {
  const m = await repos.models.getBySlug(slug);
  if (!m) throw notFound(`Model "${slug}"`);
  return m;
}

export const endpoints = {
  stats: {
    id: 'stats',
    method: 'GET',
    path: '/stats',
    summary: 'Platform statistics',
    description:
      'Counts shown on the homepage. `isDemo` is true while the database holds placeholder rows.',
    tag: 'Meta',
    response: one(statsSchema),
    cache: { ttlSeconds: 60, tags: () => ['models', 'providers', 'benchmarks'] },
    policy: READ,
    handler: async ({ repos }) => ({ data: await getStats(repos) }),
  },

  models: {
    id: 'models',
    method: 'GET',
    path: '/models',
    summary: 'List and filter models',
    description:
      'Server-side search, filtering, sorting and pagination. Filters combine with AND across groups and OR within a group. `sort=benchmark` sorts by ONE benchmark (required `benchmark` parameter); there is no overall ranking.',
    tag: 'Models',
    query: modelsQuerySchema,
    response: modelsPage,
    cache: { ttlSeconds: 60, tags: () => ['models', 'providers'] },
    policy: READ,
    handler: async (ctx) => {
      const r = await ctx.repos.models.list(q(ctx));
      return { data: r.items, meta: { ...pageMeta(r), facets: r.facets, hasDemo: r.hasDemo } };
    },
  },

  modelsSuggest: {
    id: 'modelsSuggest',
    method: 'GET',
    path: '/models/suggest',
    summary: 'Search-box suggestions',
    tag: 'Models',
    query: suggestQuerySchema,
    response: list(modelSuggestionSchema),
    cache: { ttlSeconds: 30, tags: () => ['models'] },
    policy: { maxAge: 30, swr: 120 },
    handler: async (ctx) => {
      const { q: text, limit } = q<{ q: string; limit: number }>(ctx);
      return { data: await ctx.repos.models.suggest(text, limit) };
    },
  },

  model: {
    id: 'model',
    method: 'GET',
    path: '/models/{slug}',
    summary: 'Model profile',
    tag: 'Models',
    params: slugParams,
    response: one(modelDetailSchema),
    errors: [404],
    cache: { ttlSeconds: 300, tags: (c) => ['models', `model:${(c.params as Slug).slug}`] },
    policy: DETAIL,
    handler: async (ctx) => ({ data: await requireModel(ctx.repos, p<Slug>(ctx).slug) }),
  },

  modelBenchmarks: {
    id: 'modelBenchmarks',
    method: 'GET',
    path: '/models/{slug}/benchmarks',
    summary: 'Benchmark results for a model',
    description:
      'Every result keeps its own benchmark, version, date, methodology, source and evaluation type. Nothing is averaged.',
    tag: 'Models',
    params: slugParams,
    response: list(benchmarkResultSchema),
    errors: [404],
    cache: {
      ttlSeconds: 300,
      tags: (c) => ['models', 'benchmarks', `model:${(c.params as Slug).slug}`],
    },
    policy: DETAIL,
    handler: async (ctx) => ({
      data: (await requireModel(ctx.repos, p<Slug>(ctx).slug)).benchmarks,
    }),
  },

  modelPricing: {
    id: 'modelPricing',
    method: 'GET',
    path: '/models/{slug}/pricing',
    summary: 'Pricing for a model (current and historical)',
    description:
      '`price: null` means not publicly disclosed. Historical prices have `isCurrent: false`.',
    tag: 'Models',
    params: slugParams,
    response: list(pricingEntrySchema),
    errors: [404],
    cache: { ttlSeconds: 300, tags: (c) => ['models', `model:${(c.params as Slug).slug}`] },
    policy: DETAIL,
    handler: async (ctx) => ({ data: (await requireModel(ctx.repos, p<Slug>(ctx).slug)).pricing }),
  },

  modelReleases: {
    id: 'modelReleases',
    method: 'GET',
    path: '/models/{slug}/releases',
    summary: 'Release history for a model',
    tag: 'Models',
    params: slugParams,
    response: list(releaseHistoryEntrySchema),
    errors: [404],
    cache: {
      ttlSeconds: 300,
      tags: (c) => ['models', 'releases', `model:${(c.params as Slug).slug}`],
    },
    policy: DETAIL,
    handler: async (ctx) => ({
      data: (await requireModel(ctx.repos, p<Slug>(ctx).slug)).releaseHistory,
    }),
  },

  modelRelated: {
    id: 'modelRelated',
    method: 'GET',
    path: '/models/{slug}/related',
    summary: 'Related models',
    description: 'Same provider and/or overlapping categories and capabilities.',
    tag: 'Models',
    params: slugParams,
    query: relatedQuerySchema,
    response: list(modelListItemSchema),
    errors: [404],
    cache: { ttlSeconds: 300, tags: (c) => ['models', `model:${(c.params as Slug).slug}`] },
    policy: DETAIL,
    handler: async (ctx) => {
      const slug = p<Slug>(ctx).slug;
      const related = await ctx.repos.models.related(slug, q<{ limit: number }>(ctx).limit);
      // related() is empty both for "no related models" and "unknown model": tell them apart.
      if (related.length === 0) await requireModel(ctx.repos, slug);
      return { data: related };
    },
  },

  providers: {
    id: 'providers',
    method: 'GET',
    path: '/providers',
    summary: 'List providers',
    tag: 'Providers',
    query: providersQuerySchema,
    response: paged(providerSummarySchema),
    cache: { ttlSeconds: 60, tags: () => ['providers', 'models'] },
    policy: READ,
    handler: async (ctx) => {
      const r = await ctx.repos.providers.list(q(ctx));
      return { data: r.items, meta: pageMeta(r) };
    },
  },

  provider: {
    id: 'provider',
    method: 'GET',
    path: '/providers/{slug}',
    summary: 'Provider profile',
    description: "Includes the provider's models, latest releases and publications.",
    tag: 'Providers',
    params: slugParams,
    response: one(providerDetailSchema),
    errors: [404],
    cache: { ttlSeconds: 300, tags: () => ['providers', 'models', 'releases'] },
    policy: DETAIL,
    handler: async (ctx) => {
      const r = await ctx.repos.providers.getBySlug(p<Slug>(ctx).slug);
      if (!r) throw notFound(`Provider "${p<Slug>(ctx).slug}"`);
      return { data: r };
    },
  },

  benchmarks: {
    id: 'benchmarks',
    method: 'GET',
    path: '/benchmarks',
    summary: 'List benchmarks',
    tag: 'Benchmarks',
    response: list(benchmarkSummarySchema),
    cache: { ttlSeconds: 300, tags: () => ['benchmarks'] },
    policy: DETAIL,
    handler: async ({ repos }) => ({ data: await repos.benchmarks.list() }),
  },

  benchmarkResults: {
    id: 'benchmarkResults',
    method: 'GET',
    path: '/benchmarks/results',
    summary: 'Benchmark results across models',
    description:
      'Filter by benchmark, provider, model family, model version and evaluation date range. Results are never merged into a single score; each row states its own methodology, evaluation type and source.',
    tag: 'Benchmarks',
    query: benchmarkResultsQuerySchema,
    response: paged(benchmarkResultRowSchema),
    cache: { ttlSeconds: 60, tags: () => ['benchmarks', 'models'] },
    policy: READ,
    handler: async (ctx) => {
      const r = await ctx.repos.benchmarks.results(q(ctx));
      return { data: r.items, meta: pageMeta(r) };
    },
  },

  releases: {
    id: 'releases',
    method: 'GET',
    path: '/releases',
    summary: 'Release timeline',
    description:
      '`category` is the release kind (major, minor, deprecation, capability, api-change, pricing-change, docs-update). Only officially verified or independently evaluated releases have `confirmed: true`.',
    tag: 'Releases',
    query: releasesQuerySchema,
    response: paged(releaseItemSchema),
    cache: { ttlSeconds: 60, tags: () => ['releases', 'providers'] },
    policy: READ,
    handler: async (ctx) => {
      const r = await ctx.repos.releases.list(q(ctx));
      return { data: r.items, meta: pageMeta(r) };
    },
  },

  news: {
    id: 'news',
    method: 'GET',
    path: '/news',
    summary: 'News and research',
    description:
      'Official announcements and AI-generated summaries are flagged (`isOfficial`, `isAiSummary`).',
    tag: 'News',
    query: newsQuerySchema,
    response: paged(newsItemSchema),
    cache: { ttlSeconds: 60, tags: () => ['news', 'providers'] },
    policy: READ,
    handler: async (ctx) => {
      const r = await ctx.repos.news.list(q(ctx));
      return { data: r.items, meta: pageMeta(r) };
    },
  },

  search: {
    id: 'search',
    method: 'GET',
    path: '/search',
    summary: 'Global search',
    description:
      'Searches models, providers, benchmarks, releases, news and research. `types` is a comma-separated subset.',
    tag: 'Search',
    query: searchQuerySchema,
    response: one(searchResultsSchema),
    cache: {
      ttlSeconds: 30,
      tags: () => ['models', 'providers', 'benchmarks', 'releases', 'news'],
    },
    policy: { maxAge: 30, swr: 120 },
    handler: async (ctx) => {
      const { q: text, types, limit } = q<{ q: string; types: SearchType[]; limit: number }>(ctx);
      return { data: await ctx.repos.search.search(text, types, limit) };
    },
  },

  compare: {
    id: 'compare',
    method: 'GET',
    path: '/compare',
    summary: 'Compare up to four models',
    description: 'Returns full profiles in the requested order. 404 lists any unknown slugs.',
    tag: 'Compare',
    query: compareQuerySchema,
    response: list(modelDetailSchema),
    errors: [404],
    cache: {
      ttlSeconds: 300,
      tags: (c) => ['models', ...(c.query as { models: string[] }).models.map((s) => `model:${s}`)],
    },
    policy: DETAIL,
    handler: async (ctx) => ({
      data: await loadCompare(ctx.repos, q<{ models: string[] }>(ctx).models),
    }),
  },

  compareCsv: {
    id: 'compareCsv',
    method: 'GET',
    path: '/compare/export.csv',
    summary: 'Comparison as CSV',
    description:
      'One column per model. Each benchmark is a separate row with its evaluation type and date. Cells are protected against spreadsheet formula injection.',
    tag: 'Compare',
    query: compareQuerySchema,
    response: z.string().describe('CSV document'),
    contentType: 'text/csv; charset=utf-8',
    errors: [404],
    cache: {
      ttlSeconds: 300,
      tags: (c) => ['models', ...(c.query as { models: string[] }).models.map((s) => `model:${s}`)],
    },
    policy: DETAIL,
    handler: async (ctx) =>
      compareCsv(await loadCompare(ctx.repos, q<{ models: string[] }>(ctx).models)),
    headers: (c) => ({
      'Content-Disposition': `attachment; filename="axiom-compare-${(c.query as { models: string[] }).models.join('-').slice(0, 80)}.csv"`,
    }),
  },

  health: {
    id: 'health',
    method: 'GET',
    path: '/health',
    summary: 'Service health',
    description: '200 when PostgreSQL and Redis respond, 503 otherwise. Never cached.',
    tag: 'Meta',
    response: healthSchema,
    errors: [503],
    cache: null,
    policy: 'no-store',
    // Implemented in src/app/api/v1/health/route.ts (documented here for OpenAPI only).
  },
} satisfies Record<string, Endpoint>;

async function loadCompare(repos: Repositories, slugs: string[]) {
  const found = await repos.models.getManyBySlugs(slugs);
  const have = new Set(found.map((m) => m.slug));
  const missing = slugs.filter((s) => !have.has(s));
  if (missing.length) {
    throw new ApiError(
      404,
      'NOT_FOUND',
      `Model${missing.length > 1 ? 's' : ''} ${missing.map((s) => `"${s}"`).join(', ')} not found`,
      { missing },
    );
  }
  return found;
}

export const errorResponseSchema = errorSchema;
