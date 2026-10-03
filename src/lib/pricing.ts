import type { PricingEntry, PricingType } from '@/types/model';

/** The only unit the token cost estimator understands. Other units (per image etc.) are ignored. */
export const TOKEN_UNIT = 'per 1M tokens';
export const MAX_TOKENS = 1_000_000_000_000; // 1e12, guards against absurd input

export type EstimatorInput = {
  /** Uncached input tokens (cached tokens are counted separately, not in this figure). */
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

export type EstimateLine = {
  type: Extract<PricingType, 'INPUT' | 'OUTPUT' | 'CACHED_INPUT'>;
  label: string;
  tokens: number;
  /** Price per 1M tokens, or null when not publicly disclosed. */
  pricePerMillion: number | null;
  /** null when tokens > 0 but the price is unknown (line cannot be costed). */
  cost: number | null;
};

export type EstimateResult =
  | { ok: false; error: 'INVALID_TOKENS' | 'MIXED_CURRENCY' }
  | {
      ok: true;
      lines: EstimateLine[];
      /** Sum of the lines that could be costed. */
      total: number;
      currency: string | null;
      /** True when some tokens could not be costed because a price is not disclosed. */
      partial: boolean;
      /** The price unit used (may carry a qualifier such as a tier), or null when none applies. */
      unit: string | null;
    };

/**
 * The one token unit the estimator prices against, or null when there is no unambiguous one.
 * A plain `per 1M tokens` unit always wins. Otherwise the units may carry a qualifier (a tier,
 * a deployment type): a single such unit is used, but with several variants (for example prompt
 * length tiers) no flat price applies, so the estimator is unavailable rather than picking one.
 */
export function estimatorUnit(entries: PricingEntry[]): string | null {
  const tokenRows = entries.filter((e) => e.isCurrent && e.unit.startsWith(TOKEN_UNIT));
  if (tokenRows.some((e) => e.unit === TOKEN_UNIT)) return TOKEN_UNIT;
  const units = [...new Set(tokenRows.map((e) => e.unit))];
  const paired = units.filter(
    (u) =>
      tokenRows.some((e) => e.unit === u && e.type === 'INPUT') &&
      tokenRows.some((e) => e.unit === u && e.type === 'OUTPUT'),
  );
  if (paired.length === 1) return paired[0]!;
  return paired.length === 0 && units.length === 1 ? units[0]! : null;
}

const LINES: { type: EstimateLine['type']; label: string; key: keyof EstimatorInput }[] = [
  { type: 'INPUT', label: 'Input', key: 'inputTokens' },
  { type: 'OUTPUT', label: 'Output', key: 'outputTokens' },
  { type: 'CACHED_INPUT', label: 'Cached input', key: 'cachedInputTokens' },
];

/** Removes floating point noise (e.g. 0.30000000000000004) without losing real precision. */
const clean = (n: number) => Math.round(n * 1e9) / 1e9;

const validTokens = (n: number) => Number.isFinite(n) && n >= 0 && n <= MAX_TOKENS;

/**
 * Estimates the cost of a workload from CURRENT token prices only (historical prices are
 * never used). Lines with zero tokens are still listed but cost 0. A line with tokens but
 * no disclosed price is left uncosted and flags the result as partial, so a missing price
 * is never silently treated as free.
 */
export function estimateCost(entries: PricingEntry[], input: EstimatorInput): EstimateResult {
  if (![input.inputTokens, input.outputTokens, input.cachedInputTokens].every(validTokens)) {
    return { ok: false, error: 'INVALID_TOKENS' };
  }

  const unit = estimatorUnit(entries);
  const current = entries.filter((e) => e.isCurrent && unit !== null && e.unit === unit);
  const priceFor = (type: EstimateLine['type']) => current.find((e) => e.type === type);

  // Total can only be summed in one currency.
  const currencies = new Set(
    LINES.filter((l) => input[l.key] > 0)
      .map((l) => priceFor(l.type))
      .filter((e): e is PricingEntry => !!e && e.price !== null)
      .map((e) => e.currency),
  );
  if (currencies.size > 1) return { ok: false, error: 'MIXED_CURRENCY' };

  let total = 0;
  let partial = false;
  const lines: EstimateLine[] = LINES.map(({ type, label, key }) => {
    const tokens = Math.floor(input[key]);
    const entry = priceFor(type);
    const pricePerMillion = entry?.price ?? null;
    if (tokens === 0) return { type, label, tokens, pricePerMillion, cost: 0 };
    if (pricePerMillion === null) {
      partial = true;
      return { type, label, tokens, pricePerMillion, cost: null };
    }
    const cost = clean((pricePerMillion * tokens) / 1_000_000);
    total += cost;
    return { type, label, tokens, pricePerMillion, cost };
  });

  return {
    ok: true,
    lines,
    total: clean(total),
    currency: [...currencies][0] ?? null,
    partial,
    unit,
  };
}

/** Money with at least 2 and at most 6 decimals (token costs are often fractions of a cent). */
export function formatMoney(value: number, currency: string | null): string {
  const code = currency ?? 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  } catch {
    return `${value} ${code}`; // unknown currency code
  }
}
