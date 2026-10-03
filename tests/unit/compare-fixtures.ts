import { demoModelDetails } from '../../prisma/seed/demo/models';
import type { BenchmarkResult, ModelDetail, PricingEntry } from '@/types/model';

/** Builders for /compare unit tests: a plain model cloned from a demo fixture, with overrides. */
const base = demoModelDetails[0]!;

export const result = (over: Partial<BenchmarkResult> = {}): BenchmarkResult => ({
  benchmarkSlug: 'bench-a',
  benchmarkName: 'Bench A',
  category: 'reasoning',
  benchmarkVersion: 'v1',
  score: 50,
  scoreUnit: '%',
  evaluationDate: '2026-09-01',
  modelVersion: 'm1',
  methodologyNotes: null,
  evaluationType: 'PROVIDER_REPORTED',
  sourceUrl: 'https://example.invalid/src',
  isDemo: true,
  ...over,
});

export const price = (over: Partial<PricingEntry> = {}): PricingEntry => ({
  type: 'INPUT',
  price: 1,
  currency: 'USD',
  unit: 'per 1M tokens',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  isCurrent: true,
  sourceUrl: null,
  verifiedAt: null,
  isDemo: true,
  ...over,
});

export const model = (slug: string, over: Partial<ModelDetail> = {}): ModelDetail => ({
  ...base,
  slug,
  name: slug.toUpperCase(),
  contextWindow: 100_000,
  benchmarks: [],
  pricing: [],
  ...over,
});
