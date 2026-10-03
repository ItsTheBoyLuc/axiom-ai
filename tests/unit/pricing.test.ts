import { describe, expect, it } from 'vitest';
import {
  MAX_TOKENS,
  estimateCost,
  estimatorUnit,
  formatMoney,
  type EstimateResult,
} from '@/lib/pricing';
import type { PricingEntry } from '@/types/model';

const entry = (over: Partial<PricingEntry>): PricingEntry => ({
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

const prices = [
  entry({ type: 'INPUT', price: 2 }),
  entry({ type: 'OUTPUT', price: 8 }),
  entry({ type: 'CACHED_INPUT', price: 0.5 }),
];

const ok = (r: EstimateResult) => {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r;
};

describe('estimateCost', () => {
  it('computes cost per line and in total', () => {
    const r = ok(
      estimateCost(prices, {
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        cachedInputTokens: 2_000_000,
      }),
    );
    expect(r.lines.map((l) => l.cost)).toEqual([2, 4, 1]);
    expect(r.total).toBe(7);
    expect(r.currency).toBe('USD');
    expect(r.partial).toBe(false);
  });

  it('scales linearly for small token counts', () => {
    const r = ok(
      estimateCost(prices, { inputTokens: 1234, outputTokens: 0, cachedInputTokens: 0 }),
    );
    expect(r.total).toBeCloseTo(0.002468, 9);
  });

  it('returns zero (not an error) when all token counts are zero', () => {
    const r = ok(estimateCost(prices, { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 }));
    expect(r.total).toBe(0);
    expect(r.partial).toBe(false);
  });

  it('has no floating point noise', () => {
    const p = [entry({ type: 'INPUT', price: 0.1 }), entry({ type: 'OUTPUT', price: 0.2 })];
    const r = ok(
      estimateCost(p, { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 0 }),
    );
    expect(r.total).toBe(0.3); // not 0.30000000000000004
  });

  it('flags a missing price as partial instead of treating it as free', () => {
    const p = [entry({ type: 'INPUT', price: 2 }), entry({ type: 'OUTPUT', price: null })];
    const r = ok(
      estimateCost(p, { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 0 }),
    );
    expect(r.partial).toBe(true);
    expect(r.lines[1]!.cost).toBeNull();
    expect(r.total).toBe(2);
  });

  it('flags a price type that does not exist for the model as partial', () => {
    const r = ok(
      estimateCost([entry({ type: 'INPUT', price: 2 })], {
        inputTokens: 0,
        outputTokens: 10,
        cachedInputTokens: 0,
      }),
    );
    expect(r.partial).toBe(true);
  });

  it('does not flag partial for unpriced types with zero tokens', () => {
    const r = ok(
      estimateCost([entry({ type: 'INPUT', price: 2 })], {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cachedInputTokens: 0,
      }),
    );
    expect(r.partial).toBe(false);
  });

  it('uses only CURRENT prices, never historical ones', () => {
    const p = [
      entry({ type: 'INPUT', price: 2 }),
      entry({ type: 'INPUT', price: 99, isCurrent: false, effectiveTo: '2025-12-31' }),
    ];
    expect(
      ok(estimateCost(p, { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 })).total,
    ).toBe(2);
  });

  it('ignores non-token units (e.g. per image)', () => {
    const p = [entry({ type: 'INPUT', price: 5, unit: 'per image' })];
    const r = ok(
      estimateCost(p, { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 }),
    );
    expect(r.partial).toBe(true);
    expect(r.total).toBe(0);
  });

  it('refuses to sum across currencies', () => {
    const p = [
      entry({ type: 'INPUT', price: 2 }),
      entry({ type: 'OUTPUT', price: 8, currency: 'EUR' }),
    ];
    const r = estimateCost(p, { inputTokens: 10, outputTokens: 10, cachedInputTokens: 0 });
    expect(r).toEqual({ ok: false, error: 'MIXED_CURRENCY' });
  });

  it.each([
    [-1, 0, 0],
    [0, Number.NaN, 0],
    [0, 0, Number.POSITIVE_INFINITY],
    [MAX_TOKENS + 1, 0, 0],
  ])('rejects invalid token counts (%s, %s, %s)', (i, o, c) => {
    const r = estimateCost(prices, { inputTokens: i, outputTokens: o, cachedInputTokens: c });
    expect(r).toEqual({ ok: false, error: 'INVALID_TOKENS' });
  });

  it('floors fractional token counts', () => {
    const r = ok(estimateCost(prices, { inputTokens: 1.9, outputTokens: 0, cachedInputTokens: 0 }));
    expect(r.lines[0]!.tokens).toBe(1);
  });
});

describe('formatMoney', () => {
  it('shows at least 2 and at most 6 decimals', () => {
    expect(formatMoney(7, 'USD')).toBe('$7.00');
    expect(formatMoney(0.002468, 'USD')).toBe('$0.002468');
    expect(formatMoney(1.5, 'EUR')).toContain('1.50');
  });

  it('defaults to USD and survives unknown currency codes', () => {
    expect(formatMoney(1, null)).toBe('$1.00');
    expect(formatMoney(1, 'ZZZZ')).toContain('1');
  });
});

describe('estimatorUnit and qualified units', () => {
  const qualified = (type: PricingEntry['type'], price: number, tier = 'Standard tier') =>
    entry({ type, price, unit: `per 1M tokens (${tier})` });

  it('prices against a single qualified unit and reports it', () => {
    const p = [qualified('INPUT', 0.3), qualified('OUTPUT', 2.5)];
    expect(estimatorUnit(p)).toBe('per 1M tokens (Standard tier)');
    const r = ok(
      estimateCost(p, { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 0 }),
    );
    expect(r.total).toBeCloseTo(2.8);
    expect(r.unit).toBe('per 1M tokens (Standard tier)');
  });

  it('is unavailable with several qualified variants instead of picking one', () => {
    const p = [
      qualified('INPUT', 2, 'prompts up to 200K'),
      qualified('OUTPUT', 12, 'prompts up to 200K'),
      qualified('INPUT', 4, 'prompts over 200K'),
      qualified('OUTPUT', 18, 'prompts over 200K'),
    ];
    expect(estimatorUnit(p)).toBeNull();
    const r = ok(estimateCost(p, { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 }));
    expect(r.lines.every((l) => l.pricePerMillion === null)).toBe(true);
  });

  it('prefers the plain unit and ignores historical and non-token units', () => {
    expect(estimatorUnit([...prices, qualified('INPUT', 9)])).toBe('per 1M tokens');
    expect(estimatorUnit([entry({ unit: 'per image' })])).toBeNull();
    expect(estimatorUnit([{ ...qualified('INPUT', 1), isCurrent: false }])).toBeNull();
  });
});
