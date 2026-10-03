import { z } from 'zod';
import { VERIFICATION_STATUSES } from '../../src/lib/verification';
import {
  NEWS_CATEGORIES,
  SEARCH_TYPES,
  type BenchmarkResultRow,
  type BenchmarkSummary,
  type NewsItem,
  type ProviderDetail,
  type ProviderSummary,
  type ReleaseItem,
  type SearchHit,
} from '../../src/types/catalog';
import {
  CAPABILITIES,
  CATEGORIES,
  DEPLOYMENTS,
  MODALITIES,
  PRICING_KINDS,
  RELEASE_KINDS,
  type BenchmarkResult,
  type ModelDetail,
  type ModelFacets,
  type ModelListItem,
  type ModelSuggestion,
  type PricingEntry,
  type ReleaseHistoryEntry,
} from '../../src/types/model';
import type { PlatformStats } from '../services/stats';

/**
 * Response schemas: the single description of what the API returns. They power the OpenAPI
 * document and contract tests. Each carries a compile-time check (`satisfies z.ZodType<T>`)
 * that it still matches the domain type, so docs cannot drift from the code.
 */

const status = z.enum(VERIFICATION_STATUSES);
const nullableString = z.string().nullable();
const evaluationType = z.enum(['INDEPENDENT', 'PROVIDER_REPORTED', 'COMMUNITY']);

export const benchmarkResultSchema = z.object({
  benchmarkSlug: z.string(),
  benchmarkName: z.string(),
  category: z.string(),
  benchmarkVersion: nullableString,
  score: z.number(),
  scoreUnit: z.string(),
  evaluationDate: z.string(),
  modelVersion: z.string(),
  methodologyNotes: nullableString,
  evaluationType,
  sourceUrl: nullableString,
  isDemo: z.boolean(),
}) satisfies z.ZodType<BenchmarkResult>;

export const modelListItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  family: z.string(),
  version: nullableString,
  description: z.string(),
  providerSlug: z.string(),
  providerName: z.string(),
  providerMonogram: z.string(),
  providerTier: z.enum(['listed', 'other']),
  releaseDate: z.string(),
  updatedAt: z.string(),
  contextWindow: z.number().nullable(),
  modalities: z.array(z.enum(MODALITIES)),
  availability: z.string(),
  openWeights: z.boolean(),
  deployment: z.array(z.enum(DEPLOYMENTS)),
  pricingKind: z.enum(PRICING_KINDS),
  currentPricing: z
    .object({
      input: z.number().nullable(),
      output: z.number().nullable(),
      currency: z.string(),
      unit: z.string(),
    })
    .nullable(),
  categories: z.array(z.enum(CATEGORIES)),
  capabilities: z.array(z.enum(CAPABILITIES)),
  benchmarks: z.array(benchmarkResultSchema),
  verificationStatus: status,
  isDemo: z.boolean(),
}) satisfies z.ZodType<ModelListItem>;

export const pricingEntrySchema = z.object({
  type: z.enum([
    'INPUT',
    'OUTPUT',
    'CACHED_INPUT',
    'BATCH_INPUT',
    'BATCH_OUTPUT',
    'IMAGE',
    'AUDIO',
    'OTHER',
  ]),
  price: z.number().nullable(),
  currency: z.string(),
  unit: z.string(),
  effectiveFrom: z.string(),
  effectiveTo: nullableString,
  isCurrent: z.boolean(),
  sourceUrl: nullableString,
  verifiedAt: nullableString,
  isDemo: z.boolean(),
}) satisfies z.ZodType<PricingEntry>;

export const releaseHistoryEntrySchema = z.object({
  date: z.string(),
  kind: z.enum(RELEASE_KINDS),
  title: z.string(),
  description: z.string(),
  sourceUrl: nullableString,
}) satisfies z.ZodType<ReleaseHistoryEntry>;

export const modelDetailSchema = modelListItemSchema.extend({
  sourceUrl: nullableString,
  verifiedAt: nullableString,
  collectedAt: z.string(),
  overview: z.object({
    purpose: z.string(),
    useCases: z.array(z.string()),
    notableFeatures: z.array(z.string()),
    limitations: z.array(z.string()),
  }),
  capabilityAvailability: z.array(
    z.object({
      capability: z.enum(CAPABILITIES),
      availability: z.enum(['AVAILABLE', 'LIMITED', 'PREVIEW', 'NOT_AVAILABLE']),
    }),
  ),
  specs: z.object({
    maxOutputTokens: z.number().nullable(),
    inputModalities: z.array(z.enum(MODALITIES)),
    outputModalities: z.array(z.enum(MODALITIES)),
    toolCalling: z.boolean().nullable(),
    structuredOutput: z.boolean().nullable(),
    functionCalling: z.boolean().nullable(),
    streaming: z.boolean().nullable(),
    knowledgeCutoff: nullableString,
    trainingInfo: nullableString,
    architecture: nullableString,
    apiAvailability: nullableString,
  }),
  pricing: z.array(pricingEntrySchema),
  releaseHistory: z.array(releaseHistoryEntrySchema),
  documentationUrl: nullableString,
}) satisfies z.ZodType<ModelDetail>;

export const modelSuggestionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  providerName: z.string(),
  family: z.string(),
  isDemo: z.boolean(),
}) satisfies z.ZodType<ModelSuggestion>;

const facetOption = z.object({ value: z.string(), label: z.string(), count: z.number().int() });
const facetsSchema = z.object({
  provider: z.array(facetOption),
  category: z.array(facetOption),
  capability: z.array(facetOption),
  deployment: z.array(facetOption),
  pricing: z.array(facetOption),
}) satisfies z.ZodType<ModelFacets>;

export const pageMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  pageCount: z.number().int(),
});

export const providerSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  monogram: z.string(),
  description: z.string(),
  tier: z.enum(['listed', 'other']),
  officialWebsite: nullableString,
  headquarters: nullableString,
  orgType: z.string(),
  modelCount: z.number().int(),
  verificationStatus: status,
  isDemo: z.boolean(),
}) satisfies z.ZodType<ProviderSummary>;

export const releaseItemSchema = z.object({
  id: z.string(),
  kind: z.enum(RELEASE_KINDS),
  date: z.string(),
  title: z.string(),
  description: z.string(),
  announcementUrl: nullableString,
  docsUrl: nullableString,
  provider: z.object({ slug: z.string(), name: z.string() }),
  model: z.object({ slug: z.string(), name: z.string() }).nullable(),
  confirmed: z.boolean(),
  verificationStatus: status,
  isDemo: z.boolean(),
}) satisfies z.ZodType<ReleaseItem>;

export const providerDetailSchema = providerSummarySchema.extend({
  logoUrl: nullableString,
  sourceUrl: nullableString,
  verifiedAt: nullableString,
  collectedAt: z.string(),
  models: z.array(modelListItemSchema),
  releases: z.array(releaseItemSchema),
  publications: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      publishedAt: z.string(),
      venue: nullableString,
    }),
  ),
}) satisfies z.ZodType<ProviderDetail>;

export const benchmarkSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  version: nullableString,
  description: z.string(),
  methodologyUrl: nullableString,
  resultCount: z.number().int(),
  modelCount: z.number().int(),
  latestDate: nullableString,
  byType: z.object({
    INDEPENDENT: z.number().int(),
    PROVIDER_REPORTED: z.number().int(),
    COMMUNITY: z.number().int(),
  }),
  units: z.array(z.string()),
  verificationStatus: status,
  isDemo: z.boolean(),
}) satisfies z.ZodType<BenchmarkSummary>;

export const benchmarkResultRowSchema = benchmarkResultSchema.extend({
  model: z.object({
    slug: z.string(),
    name: z.string(),
    family: z.string(),
    version: nullableString,
  }),
  provider: z.object({ slug: z.string(), name: z.string() }),
}) satisfies z.ZodType<BenchmarkResultRow>;

export const newsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  publisher: z.string(),
  url: z.string(),
  publishedAt: z.string(),
  category: z.enum(NEWS_CATEGORIES),
  isOfficial: z.boolean(),
  isAiSummary: z.boolean(),
  provider: z.object({ slug: z.string(), name: z.string() }).nullable(),
  models: z.array(z.object({ slug: z.string(), name: z.string() })),
  verificationStatus: status,
  isDemo: z.boolean(),
}) satisfies z.ZodType<NewsItem>;

const searchHit = z.object({
  type: z.enum(SEARCH_TYPES),
  id: z.string(),
  title: z.string(),
  subtitle: nullableString,
  href: z.string(),
  isDemo: z.boolean(),
}) satisfies z.ZodType<SearchHit>;

export const statsSchema = z.object({
  totalModels: z.number().int(),
  providers: z.number().int(),
  releasedThisMonth: z.number().int(),
  benchmarks: z.number().int(),
  recentlyUpdated: z.number().int(),
  isDemo: z.boolean(),
  lastDataUpdate: nullableString,
}) satisfies z.ZodType<PlatformStats>;

export const searchResultsSchema = z.object({
  q: z.string(),
  results: z.object(
    Object.fromEntries(SEARCH_TYPES.map((t) => [t, z.array(searchHit)])) as Record<
      (typeof SEARCH_TYPES)[number],
      z.ZodArray<typeof searchHit>
    >,
  ),
});

export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({
    postgres: z.object({ ok: z.boolean(), latencyMs: z.number(), error: z.string().optional() }),
    redis: z.object({ ok: z.boolean(), latencyMs: z.number(), error: z.string().optional() }),
  }),
  timestamp: z.string(),
});

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

/** Envelope builders. */
export const one = <T extends z.ZodType>(data: T) => z.object({ data });
export const list = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) });
export const paged = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), meta: pageMetaSchema });
export const modelsPage = z.object({
  data: z.array(modelListItemSchema),
  meta: pageMetaSchema.extend({ facets: facetsSchema, hasDemo: z.boolean() }),
});
