import { describe, expect, it } from 'vitest';
import {
  MAX_RADAR_AXES,
  benchmarkOptions,
  benchmarkSeries,
  contextSeries,
  priceSeries,
  radarData,
} from '@/lib/compare/charts';
import type { BenchmarkResult } from '@/types/model';
import { model, price, result } from './compare-fixtures';

const withScores = (
  slug: string,
  scores: Record<string, number>,
  over: Partial<BenchmarkResult> = {},
) =>
  model(slug, {
    benchmarks: Object.entries(scores).map(([k, v]) =>
      result({ benchmarkSlug: k, benchmarkName: k.toUpperCase(), score: v, ...over }),
    ),
  });

describe('contextSeries', () => {
  it('names a model without a context window instead of drawing it as zero', () => {
    const s = contextSeries([
      model('a', { contextWindow: 1000 }),
      model('b', { contextWindow: null }),
    ]);
    expect(s.data).toEqual([{ label: 'A', value: 1000 }]);
    expect(s.omitted).toEqual(['B']);
  });
});

describe('priceSeries', () => {
  it('uses one flat per-token price and shows a qualifier under the name', () => {
    const q = model('q', {
      pricing: [price({ price: 0.3, unit: 'per 1M tokens (Standard tier, global)' })],
    });
    const p = model('p', { pricing: [price({ price: 1 })] });
    const s = priceSeries([q, p], 'INPUT');
    expect(s).toMatchObject({ ok: true, currency: 'USD', omitted: [] });
    if (s.ok) {
      expect(s.data).toEqual([
        { label: 'Q\nStandard tier, global', value: 0.3 },
        { label: 'P', value: 1 },
      ]);
    }
  });

  it('leaves out models with tiers, no price or an undisclosed price, and names them', () => {
    const tiered = model('t', {
      pricing: [
        price({ price: 2, unit: 'per 1M tokens (up to 200K)' }),
        price({ price: 4, unit: 'per 1M tokens (over 200K)' }),
      ],
    });
    const none = model('n');
    const nul = model('u', { pricing: [price({ price: null })] });
    const ok = model('o', { pricing: [price({ price: 1 })] });
    const s = priceSeries([tiered, none, nul, ok], 'INPUT');
    expect([...s.omitted].sort()).toEqual(['N', 'T', 'U']);
    expect(s.ok && s.data).toHaveLength(1);
  });

  it('refuses to chart mixed currencies and reports when nothing can be charted', () => {
    const eur = model('e', { pricing: [price({ currency: 'EUR' })] });
    const usd = model('d', { pricing: [price({ currency: 'USD' })] });
    expect(priceSeries([eur, usd], 'INPUT')).toMatchObject({ ok: false });
    expect(priceSeries([model('x')], 'OUTPUT')).toMatchObject({ ok: false, omitted: ['X'] });
  });
});

describe('benchmarkOptions and benchmarkSeries', () => {
  const a = withScores('a', { x: 70, y: 10 });
  const b = withScores('b', { x: 60 });

  it('offers only benchmarks that at least two models have, most shared first', () => {
    expect(benchmarkOptions([a, b])).toEqual([{ slug: 'x', name: 'X', count: 2 }]);
    expect(benchmarkOptions([a])).toEqual([]);
  });

  it('labels each bar with its evaluation type and date, and lists models without a result', () => {
    const s = benchmarkSeries([a, b, model('c')], 'x');
    expect(s).toMatchObject({ ok: true, unit: '%', omitted: ['C'] });
    if (s.ok) expect(s.data[0]!.label).toBe('A\nProvider reported · 2026-09-01');
  });

  it('carries a caveat when evaluation types differ and refuses mixed units', () => {
    const ind = withScores('i', { x: 50 }, { evaluationType: 'INDEPENDENT' });
    const s = benchmarkSeries([a, ind], 'x');
    expect(s.ok && s.caveat).toMatch(/evaluation types differ/);
    const elo = withScores('e', { x: 1500 }, { scoreUnit: 'Elo' });
    expect(benchmarkSeries([a, elo], 'x')).toMatchObject({ ok: false });
  });
});

describe('radarData', () => {
  const full = (slug: string, base: number) =>
    withScores(slug, { a: base, b: base + 1, c: base + 2, d: base + 3 });

  it('uses benchmarks every model has, in %, with one evaluation type and version', () => {
    const r = radarData([full('m1', 10), full('m2', 20)]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.axes.map((x) => x.slug)).toEqual(['a', 'b', 'c', 'd']);
      expect(r.series[1]).toEqual({ name: 'M2', values: [20, 21, 22, 23] });
    }
  });

  it('is not offered with fewer than three shared benchmarks, and says why', () => {
    const r = radarData([full('m1', 10), withScores('m2', { a: 1, b: 2 })]);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.reason).toMatch(/Only 2 qualify/);
  });

  it('drops benchmarks that mix evaluation types, versions or units, or leave 0-100', () => {
    const m1 = full('m1', 10);
    const m2 = {
      ...full('m2', 20),
      benchmarks: [
        result({ benchmarkSlug: 'a', score: 20, evaluationType: 'INDEPENDENT' }),
        result({ benchmarkSlug: 'b', score: 21, benchmarkVersion: 'v2' }),
        result({ benchmarkSlug: 'c', score: 22, scoreUnit: 'score' }),
        result({ benchmarkSlug: 'd', score: 120 }),
      ],
    };
    expect(radarData([m1, m2])).toMatchObject({ ok: false });
  });

  it('caps the axes and reports how many qualified; needs two models', () => {
    const keys = Array.from({ length: 12 }, (_, i) => `k${String(i).padStart(2, '0')}`);
    const many = (slug: string) =>
      withScores(slug, Object.fromEntries(keys.map((k, i) => [k, 10 + i])));
    const r = radarData([many('m1'), many('m2')]);
    expect(r.ok && r.axes).toHaveLength(MAX_RADAR_AXES);
    expect(r.ok && r.eligible).toBe(12);
    expect(radarData([many('solo')])).toMatchObject({ ok: false });
  });
});
