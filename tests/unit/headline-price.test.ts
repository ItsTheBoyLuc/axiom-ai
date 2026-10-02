import { describe, expect, it } from 'vitest';
import { headlineTokenPrice } from '../../server/repositories/prisma/model-mappers';

const row = (pricingType: string, price: number | null, unit: string, over = {}) => ({
  pricingType,
  price: price === null ? null : { toNumber: () => price },
  currency: 'USD',
  unit,
  isCurrent: true,
  ...over,
});

describe('headlineTokenPrice', () => {
  it('uses the plain per-1M-token pair', () => {
    expect(
      headlineTokenPrice([row('INPUT', 2, 'per 1M tokens'), row('OUTPUT', 10, 'per 1M tokens')]),
    ).toEqual({ input: 2, output: 10, currency: 'USD', unit: 'per 1M tokens' });
  });

  it('uses a single qualified pair and keeps the qualifier in the unit', () => {
    const unit = 'per 1M tokens (prompts up to 200K tokens)';
    expect(headlineTokenPrice([row('INPUT', 2, unit), row('OUTPUT', 6, unit)])).toEqual({
      input: 2,
      output: 6,
      currency: 'USD',
      unit,
    });
  });

  it('has no headline when several tiers carry a pair (never collapses variants)', () => {
    const a = 'per 1M tokens (prompts up to 200K tokens)';
    const b = 'per 1M tokens (prompts over 200K tokens)';
    expect(
      headlineTokenPrice([
        row('INPUT', 2, a),
        row('OUTPUT', 12, a),
        row('INPUT', 4, b),
        row('OUTPUT', 18, b),
      ]),
    ).toBeNull();
  });

  it('has no headline when input and output use different qualifiers (peak and off-peak)', () => {
    expect(
      headlineTokenPrice([
        row('INPUT', 0.3, 'per 1M tokens (peak hours), cache miss'),
        row('INPUT', 0.15, 'per 1M tokens (off-peak hours), cache miss'),
        row('OUTPUT', 1.2, 'per 1M tokens (peak hours)'),
        row('OUTPUT', 0.6, 'per 1M tokens (off-peak hours)'),
      ]),
    ).toBeNull();
  });

  it('ignores historical prices, other price types and non-token units', () => {
    expect(
      headlineTokenPrice([
        row('INPUT', 9, 'per 1M tokens', { isCurrent: false }),
        row('CACHED_INPUT', 0.1, 'per 1M tokens'),
        row('IMAGE', 30, 'per 1M image output tokens'),
        row('INPUT', 1, 'per 1M tokens'),
        row('OUTPUT', 3, 'per 1M tokens'),
      ]),
    ).toEqual({ input: 1, output: 3, currency: 'USD', unit: 'per 1M tokens' });
  });

  it('keeps a lone plain-unit price (input published, output not)', () => {
    expect(headlineTokenPrice([row('INPUT', 0.5, 'per 1M tokens')])).toEqual({
      input: 0.5,
      output: null,
      currency: 'USD',
      unit: 'per 1M tokens',
    });
  });

  it('returns null with no token prices', () => {
    expect(headlineTokenPrice([])).toBeNull();
    expect(headlineTokenPrice([row('IMAGE', 30, 'per 1M image output tokens')])).toBeNull();
  });
});
