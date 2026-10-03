import { NOT_DISCLOSED } from '@/lib/verification';
import type { BenchmarkResult, EvaluationType, ModelDetail, PricingType } from '@/types/model';

/**
 * Value formatting shared by the /compare table and the CSV export, so the two can never
 * disagree. Pure and React-free. A missing value is "Not publicly disclosed", never blank or 0.
 */

export const evaluationTypeLabel: Record<EvaluationType, string> = {
  INDEPENDENT: 'Independent',
  PROVIDER_REPORTED: 'Provider reported',
  COMMUNITY: 'Community reported',
};

/** Current price entries of one type. A listed-but-undisclosed price (null) is kept as an entry. */
function currentEntries(m: Pick<ModelDetail, 'pricing'>, type: PricingType) {
  return m.pricing.filter((p) => p.isCurrent && p.type === type);
}

/**
 * One line per current price variant of this type, e.g. "0.3 USD per 1M tokens (Standard tier)".
 * Variants (tiers, deployment types) are listed separately, never collapsed into one number.
 * No current entry, or an undisclosed price, reads "Not publicly disclosed".
 */
export function priceLines(m: Pick<ModelDetail, 'pricing'>, type: PricingType): string[] {
  const lines = currentEntries(m, type).map((p) =>
    p.price === null ? NOT_DISCLOSED : `${p.price} ${p.currency} ${p.unit}`,
  );
  return lines.length ? lines : [NOT_DISCLOSED];
}

/** True when this model lists at least one current price of this type (used to skip empty rows). */
export const hasPriceOfType = (m: Pick<ModelDetail, 'pricing'>, type: PricingType) =>
  currentEntries(m, type).length > 0;

/** "74% (independent, 2026-07-15, model v2)" - the CSV form of one benchmark result. */
export function benchmarkText(r: BenchmarkResult): string {
  return `${r.score}${r.scoreUnit} (${r.evaluationType.toLowerCase().replaceAll('_', ' ')}, ${r.evaluationDate}, model ${r.modelVersion})`;
}

/** Yes / No / not disclosed for an optional boolean. */
export const yesNo = (v: boolean | null | undefined): string =>
  v === null || v === undefined ? NOT_DISCLOSED : v ? 'Yes' : 'No';
