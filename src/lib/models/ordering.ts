import { compareKeys, sortKey } from '@/lib/text';
import {
  CAPABILITIES,
  RELEASE_KINDS,
  type BenchmarkResult,
  type EvaluationType,
  type PricingEntry,
  type PricingType,
  type ReleaseHistoryEntry,
} from '@/types/model';

/**
 * Canonical ordering for nested collections. Arrays inside a model (capabilities, results,
 * prices, history) have no natural order in a relational database, so BOTH the in-memory
 * fixtures and the Prisma repositories apply these functions. That keeps API/UI output
 * deterministic and lets parity tests compare the two implementations directly.
 */

export const PRICING_TYPE_ORDER: PricingType[] = [
  'INPUT',
  'OUTPUT',
  'CACHED_INPUT',
  'BATCH_INPUT',
  'BATCH_OUTPUT',
  'IMAGE',
  'AUDIO',
  'OTHER',
];

/** Higher = more trusted when two results share a date. */
export const EVALUATION_TRUST: Record<EvaluationType, number> = {
  INDEPENDENT: 3,
  PROVIDER_REPORTED: 2,
  COMMUNITY: 1,
};

export function sortCapabilities<T extends string>(caps: T[]): T[] {
  const idx = (c: string) => (CAPABILITIES as readonly string[]).indexOf(c);
  return [...caps].sort((a, b) => idx(a) - idx(b));
}

/** Benchmark name, then newest first, then most trusted evaluation type, then model version. */
export function sortResults(results: BenchmarkResult[]): BenchmarkResult[] {
  return [...results].sort(
    (a, b) =>
      compareKeys(sortKey(a.benchmarkName), sortKey(b.benchmarkName)) ||
      compareKeys(b.evaluationDate, a.evaluationDate) ||
      EVALUATION_TRUST[b.evaluationType] - EVALUATION_TRUST[a.evaluationType] ||
      compareKeys(a.modelVersion, b.modelVersion),
  );
}

/** Current prices first, then by price type, newest effective date first. */
export function sortPricing(prices: PricingEntry[]): PricingEntry[] {
  return [...prices].sort(
    (a, b) =>
      Number(b.isCurrent) - Number(a.isCurrent) ||
      PRICING_TYPE_ORDER.indexOf(a.type) - PRICING_TYPE_ORDER.indexOf(b.type) ||
      compareKeys(b.effectiveFrom, a.effectiveFrom) ||
      compareKeys(a.unit, b.unit),
  );
}

/** Newest first; same-day events ordered by kind, then title. */
export function sortHistory(entries: ReleaseHistoryEntry[]): ReleaseHistoryEntry[] {
  return [...entries].sort(
    (a, b) =>
      compareKeys(b.date, a.date) ||
      RELEASE_KINDS.indexOf(a.kind) - RELEASE_KINDS.indexOf(b.kind) ||
      compareKeys(a.title, b.title),
  );
}
