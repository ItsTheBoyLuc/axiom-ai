import type { Prisma } from '../../../prisma/generated/client';
import { pickLatest } from '../../../src/lib/models/benchmarks';
import {
  sortCapabilities,
  sortHistory,
  sortPricing,
  sortResults,
} from '../../../src/lib/models/ordering';
import { NOT_DISCLOSED, type VerificationStatus } from '../../../src/lib/verification';
import {
  availabilityLabel,
  type AvailabilityKey,
  type BenchmarkResult,
  type Capability,
  type CapabilityAvailability,
  type Category,
  type Deployment,
  type EvaluationType,
  type Modality,
  type ModelDetail,
  type ModelListItem,
  type PricingEntry,
  type PricingKind,
  type PricingType,
  type ReleaseKind,
} from '../../../src/types/model';
import {
  fromDbEnum,
  fromDbEnums,
  isoDate,
  isoDateTime,
  isoDateTimeOrNull,
  monogramOf,
} from '../../db/mappers';

export const TOKEN_UNIT = 'per 1M tokens';

/**
 * Column sets ("select-only-needed-columns"). Never `include: true`: the search blob and
 * tsvector, audit fields and unused relations must not travel on every request.
 */
const resultSelect = {
  score: true,
  scoreUnit: true,
  evaluationDate: true,
  modelVersion: true,
  benchmarkVersion: true,
  methodologyNotes: true,
  evaluationType: true,
  sourceUrl: true,
  isDemo: true,
  benchmark: { select: { slug: true, name: true, category: true } },
} satisfies Prisma.BenchmarkResultSelect;

export const listSelect = {
  slug: true,
  name: true,
  family: true,
  version: true,
  description: true,
  releaseDate: true,
  updatedAt: true,
  contextWindow: true,
  openWeights: true,
  availability: true,
  deployment: true,
  pricingKind: true,
  categories: true,
  inputModalities: true,
  outputModalities: true,
  verificationStatus: true,
  isDemo: true,
  provider: { select: { slug: true, name: true, monogram: true, isListed: true } },
  capabilities: {
    where: { availability: { not: 'NOT_AVAILABLE' } },
    select: { availability: true, capability: { select: { name: true } } },
  },
  pricing: {
    where: { isCurrent: true, unit: TOKEN_UNIT, pricingType: { in: ['INPUT', 'OUTPUT'] } },
    select: { pricingType: true, price: true, currency: true, unit: true, isCurrent: true },
  },
  benchmarkResults: { select: resultSelect },
} satisfies Prisma.ModelSelect;

export const detailSelect = {
  ...listSelect,
  // detail needs every capability row (incl. availability) and every price, current or historical
  capabilities: { select: { availability: true, capability: { select: { name: true } } } },
  pricing: {
    select: {
      pricingType: true,
      price: true,
      currency: true,
      unit: true,
      isCurrent: true,
      effectiveFrom: true,
      effectiveTo: true,
      sourceUrl: true,
      verifiedAt: true,
      isDemo: true,
    },
  },
  maxOutputTokens: true,
  officialDocumentation: true,
  knowledgeCutoff: true,
  architecture: true,
  trainingInfo: true,
  apiAvailability: true,
  structuredOutput: true,
  streaming: true,
  toolCalling: true,
  functionCalling: true,
  purpose: true,
  useCases: true,
  notableFeatures: true,
  limitations: true,
  sourceUrl: true,
  verifiedAt: true,
  collectedAt: true,
  releases: {
    select: {
      kind: true,
      releaseDate: true,
      title: true,
      description: true,
      announcementUrl: true,
    },
  },
} satisfies Prisma.ModelSelect;

type ListRow = Prisma.ModelGetPayload<{ select: typeof listSelect }>;
type DetailRow = Prisma.ModelGetPayload<{ select: typeof detailSelect }>;
type ResultRow = Prisma.BenchmarkResultGetPayload<{ select: typeof resultSelect }>;

export function mapResult(r: ResultRow): BenchmarkResult {
  return {
    benchmarkSlug: r.benchmark.slug,
    benchmarkName: r.benchmark.name,
    category: r.benchmark.category,
    benchmarkVersion: r.benchmarkVersion,
    score: r.score.toNumber(),
    scoreUnit: r.scoreUnit,
    evaluationDate: isoDate(r.evaluationDate),
    modelVersion: r.modelVersion,
    methodologyNotes: r.methodologyNotes,
    evaluationType: r.evaluationType as EvaluationType,
    sourceUrl: r.sourceUrl,
    isDemo: r.isDemo,
  };
}

/** Maps a row that has at least the list columns (list and detail rows both qualify). */
export function toListItem(
  row: Pick<
    ListRow,
    | 'slug'
    | 'name'
    | 'family'
    | 'version'
    | 'description'
    | 'releaseDate'
    | 'updatedAt'
    | 'contextWindow'
    | 'openWeights'
    | 'availability'
    | 'deployment'
    | 'pricingKind'
    | 'categories'
    | 'inputModalities'
    | 'outputModalities'
    | 'verificationStatus'
    | 'isDemo'
    | 'provider'
    | 'benchmarkResults'
  > & {
    capabilities: { availability: string; capability: { name: string } }[];
    pricing: {
      pricingType: string;
      price: Prisma.Decimal | null;
      currency: string;
      unit: string;
      isCurrent: boolean;
    }[];
  },
): ModelListItem {
  const tokenPrices = row.pricing.filter(
    (p) =>
      p.isCurrent &&
      p.unit === TOKEN_UNIT &&
      (p.pricingType === 'INPUT' || p.pricingType === 'OUTPUT'),
  );
  const input = tokenPrices.find((p) => p.pricingType === 'INPUT');
  const output = tokenPrices.find((p) => p.pricingType === 'OUTPUT');
  const first = input ?? output;

  return {
    slug: row.slug,
    name: row.name,
    family: row.family,
    version: row.version,
    description: row.description,
    providerSlug: row.provider.slug,
    providerName: row.provider.name,
    providerMonogram: monogramOf(row.provider.name, row.provider.monogram),
    providerTier: row.provider.isListed ? 'listed' : 'other',
    releaseDate: isoDate(row.releaseDate),
    updatedAt: isoDateTime(row.updatedAt),
    contextWindow: row.contextWindow,
    // input modalities first, then output-only ones, without duplicates
    modalities: [...new Set([...row.inputModalities, ...row.outputModalities])].map((m) =>
      fromDbEnum<Modality>(m),
    ),
    availability: availabilityLabel[row.availability as AvailabilityKey],
    openWeights: row.openWeights,
    deployment: fromDbEnums<Deployment>(row.deployment),
    pricingKind: fromDbEnum<PricingKind>(row.pricingKind),
    currentPricing: first
      ? {
          input: input?.price?.toNumber() ?? null,
          output: output?.price?.toNumber() ?? null,
          currency: first.currency,
          unit: TOKEN_UNIT,
        }
      : null,
    categories: fromDbEnums<Category>(row.categories),
    capabilities: sortCapabilities(
      row.capabilities
        .filter((c) => c.availability !== 'NOT_AVAILABLE')
        .map((c) => c.capability.name as Capability),
    ),
    benchmarks: sortResults(row.benchmarkResults.map(mapResult)),
    verificationStatus: row.verificationStatus as VerificationStatus,
    isDemo: row.isDemo,
  };
}

export function toDetail(row: DetailRow): ModelDetail {
  const base = toListItem(row);
  const pricing: PricingEntry[] = row.pricing.map((p) => ({
    type: p.pricingType as PricingType,
    price: p.price === null ? null : p.price.toNumber(),
    currency: p.currency,
    unit: p.unit,
    effectiveFrom: isoDate(p.effectiveFrom),
    effectiveTo: p.effectiveTo ? isoDate(p.effectiveTo) : null,
    isCurrent: p.isCurrent,
    sourceUrl: p.sourceUrl,
    verifiedAt: isoDateTimeOrNull(p.verifiedAt),
    isDemo: p.isDemo,
  }));

  return {
    ...base,
    sourceUrl: row.sourceUrl,
    verifiedAt: isoDateTimeOrNull(row.verifiedAt),
    collectedAt: isoDateTime(row.collectedAt),
    overview: {
      purpose: row.purpose ?? NOT_DISCLOSED,
      useCases: row.useCases,
      notableFeatures: row.notableFeatures,
      limitations: row.limitations,
    },
    capabilityAvailability: sortCapabilities(
      row.capabilities.map((c) => c.capability.name as Capability),
    ).map((capability) => ({
      capability,
      availability: row.capabilities.find((c) => c.capability.name === capability)!
        .availability as CapabilityAvailability,
    })),
    specs: {
      maxOutputTokens: row.maxOutputTokens,
      inputModalities: fromDbEnums<Modality>(row.inputModalities),
      outputModalities: fromDbEnums<Modality>(row.outputModalities),
      toolCalling: row.toolCalling,
      structuredOutput: row.structuredOutput,
      functionCalling: row.functionCalling,
      streaming: row.streaming,
      knowledgeCutoff: row.knowledgeCutoff,
      trainingInfo: row.trainingInfo,
      architecture: row.architecture,
      apiAvailability: row.apiAvailability,
    },
    pricing: sortPricing(pricing),
    releaseHistory: sortHistory(
      row.releases.map((r) => ({
        date: isoDate(r.releaseDate),
        kind: r.kind as ReleaseKind,
        title: r.title,
        description: r.description,
        sourceUrl: r.announcementUrl,
      })),
    ),
    documentationUrl: row.officialDocumentation,
  };
}

export { pickLatest };
