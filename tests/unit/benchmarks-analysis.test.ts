import { describe, expect, it } from 'vitest';
import {
  MAX_BINS,
  MAX_HISTORY_SERIES,
  MIN_DISTRIBUTION,
  chartRows,
  distribution,
  facetsOf,
  filterRows,
  historySeries,
  latestPerModel,
  providerDots,
  typeMix,
} from '@/lib/benchmarks/analysis';
import { emptyQuery } from '@/lib/benchmarks/query';
import { formatScore } from '@/lib/benchmarks/format';
import { row, rows } from './benchmarks-fixtures';

describe('filterRows', () => {
  const data = [
    row({
      model: { slug: 'a', family: 'Gemini' },
      provider: { slug: 'google' },
      modelVersion: 'v1',
      evaluationDate: '2026-06-01',
    }),
    row({
      model: { slug: 'b', family: 'GPT' },
      provider: { slug: 'openai' },
      modelVersion: 'v2',
      evaluationDate: '2026-08-01',
      evaluationType: 'INDEPENDENT',
    }),
    row({
      model: { slug: 'c', family: 'GPT' },
      provider: { slug: 'openai' },
      modelVersion: 'v3',
      evaluationDate: '2026-09-01',
    }),
  ];
  const slugs = (q: Partial<typeof emptyQuery>) =>
    filterRows(data, { ...emptyQuery, ...q }).map((r) => r.model.slug);

  it('returns everything without filters', () => expect(slugs({})).toEqual(['a', 'b', 'c']));
  it('filters by provider', () => expect(slugs({ provider: 'openai' })).toEqual(['b', 'c']));
  it('filters by family, ignoring case', () =>
    expect(slugs({ family: 'gpt' })).toEqual(['b', 'c']));
  it('filters by model version', () => expect(slugs({ version: 'v3' })).toEqual(['c']));
  it('filters by evaluation type', () => expect(slugs({ type: 'INDEPENDENT' })).toEqual(['b']));
  it('filters by an inclusive date range', () => {
    expect(slugs({ from: '2026-08-01', to: '2026-09-01' })).toEqual(['b', 'c']);
    expect(slugs({ from: '2026-08-02' })).toEqual(['c']);
    expect(slugs({ to: '2026-06-01' })).toEqual(['a']);
  });
  it('combines filters', () => {
    expect(slugs({ provider: 'openai', type: 'PROVIDER_REPORTED' })).toEqual(['c']);
    expect(slugs({ provider: 'google', type: 'INDEPENDENT' })).toEqual([]);
  });
});

describe('facetsOf', () => {
  it('lists each option once, with counts and labels, and the date range', () => {
    const f = facetsOf([
      row({
        model: { slug: 'a', family: 'GPT' },
        provider: { slug: 'openai', name: 'OpenAI' },
        evaluationDate: '2026-09-01',
      }),
      row({
        model: { slug: 'b', family: 'GPT' },
        provider: { slug: 'openai', name: 'OpenAI' },
        evaluationDate: '2026-06-01',
        evaluationType: 'INDEPENDENT',
      }),
      row({
        model: { slug: 'c', family: 'Gemini' },
        provider: { slug: 'google', name: 'Google' },
        evaluationDate: '2026-08-01',
      }),
    ]);
    expect(f.providers).toEqual([
      { value: 'google', label: 'Google', count: 1 },
      { value: 'openai', label: 'OpenAI', count: 2 },
    ]);
    expect(f.families.map((x) => x.label)).toEqual(['Gemini', 'GPT']);
    expect(f.types.map((x) => x.label).sort()).toEqual(['Independent', 'Provider reported']);
    expect([f.minDate, f.maxDate]).toEqual(['2026-06-01', '2026-09-01']);
  });

  it('has no date range without results', () => {
    expect(facetsOf([])).toMatchObject({ minDate: null, maxDate: null, providers: [] });
  });
});

describe('latestPerModel', () => {
  it('keeps the newest result of each model', () => {
    const out = latestPerModel([
      row({ score: 10, evaluationDate: '2026-06-01' }),
      row({ score: 20, evaluationDate: '2026-09-01' }),
      row({ score: 30, evaluationDate: '2026-08-01', model: { slug: 'other', name: 'Other' } }),
    ]);
    expect(out.map((r) => r.score).sort()).toEqual([20, 30]);
  });

  it('on the same date prefers the more trusted evaluation type', () => {
    const out = latestPerModel([
      row({ score: 1, evaluationType: 'PROVIDER_REPORTED' }),
      row({ score: 2, evaluationType: 'INDEPENDENT' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.score).toBe(2);
  });
});

describe('chartRows', () => {
  it('uses the most common unit and names the others', () => {
    const c = chartRows([
      row({ scoreUnit: '%' }),
      row({ scoreUnit: '%' }),
      row({ scoreUnit: 'Elo' }),
    ]);
    expect(c.unit).toBe('%');
    expect(c.rows).toHaveLength(2);
    expect(c.otherUnits).toEqual(['Elo']);
  });
  it('breaks a tie alphabetically and handles no rows', () => {
    expect(chartRows([row({ scoreUnit: 'score' }), row({ scoreUnit: 'Elo' })]).unit).toBe('Elo');
    expect(chartRows([])).toEqual({ unit: null, rows: [], otherUnits: [] });
  });
});

describe('typeMix and formatScore', () => {
  it('counts each evaluation type, including zeros', () => {
    expect(typeMix([row(), row({ evaluationType: 'INDEPENDENT' })])).toEqual({
      INDEPENDENT: 1,
      PROVIDER_REPORTED: 1,
      COMMUNITY: 0,
    });
  });
  it('formats percentages without a space and other units with one', () => {
    expect(formatScore(57.8, '%')).toBe('57.8%');
    expect(formatScore(1500, 'Elo')).toBe('1500 Elo');
  });
});

describe('historySeries', () => {
  it('says nothing about time when every result has the same date', () => {
    expect(historySeries([row(), row({ model: { slug: 'b', family: 'B' } })]).series).toEqual([]);
  });

  it('builds one time-ordered line per family; a lone result is a single point', () => {
    const { series } = historySeries([
      row({
        score: 2,
        evaluationDate: '2026-09-01',
        model: { slug: 'a2', name: 'A2', family: 'A' },
      }),
      row({
        score: 1,
        evaluationDate: '2026-06-01',
        model: { slug: 'a1', name: 'A1', family: 'A' },
      }),
      row({
        score: 9,
        evaluationDate: '2026-07-01',
        model: { slug: 'b1', name: 'B1', family: 'B' },
      }),
    ]);
    expect(series.map((s) => s.name)).toEqual(['A', 'B']); // most points first
    expect(series[0]!.points.map((p) => p.value)).toEqual([1, 2]);
    expect(series[1]!.points).toHaveLength(1);
  });

  it('caps the number of families and names the ones left out', () => {
    const many = Array.from({ length: MAX_HISTORY_SERIES + 2 }, (_, i) =>
      row({ evaluationDate: `2026-0${(i % 8) + 1}-01`, model: { slug: `m${i}`, family: `F${i}` } }),
    );
    const { series, omitted } = historySeries(many);
    expect(series).toHaveLength(MAX_HISTORY_SERIES);
    expect(omitted).toHaveLength(2);
  });
});

describe('distribution', () => {
  it(`needs at least ${MIN_DISTRIBUTION} models`, () => {
    expect(distribution(rows([1, 2, 3, 4]))).toBeNull();
    expect(distribution(rows([1, 2, 3, 4, 5]))).not.toBeNull();
  });

  it('counts every model exactly once, including the maximum', () => {
    const data = rows([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const d = distribution(data)!;
    expect(d.n).toBe(10);
    expect(d.bins.reduce((n, b) => n + b.count, 0)).toBe(10);
    expect(d.bins.length).toBeLessThanOrEqual(MAX_BINS);
    expect(d.bins[d.bins.length - 1]!.models).toContain('M9'); // the 100 sits in the last bin
    expect(d.bins[0]!.from).toBe(10);
    expect(d.bins[d.bins.length - 1]!.to).toBe(100);
  });

  it('puts identical scores in a single bin', () => {
    const d = distribution(rows([5, 5, 5, 5, 5]))!;
    expect(d.bins).toHaveLength(1);
    expect(d.bins[0]!.count).toBe(5);
  });
});

describe('providerDots', () => {
  it('needs two providers; otherwise there is nothing to compare', () => {
    expect(providerDots([row(), row({ model: { slug: 'b' } })])).toEqual({
      providers: [],
      dots: [],
    });
  });

  it('lists providers alphabetically with one dot per model', () => {
    const out = providerDots([
      row({ model: { slug: 'z', name: 'Zed' }, provider: { slug: 'p2', name: 'Zeta' } }),
      row({ model: { slug: 'a', name: 'Ay' }, provider: { slug: 'p1', name: 'Alpha' }, score: 7 }),
    ]);
    expect(out.providers).toEqual(['Alpha', 'Zeta']);
    expect(out.dots.map((d) => [d.y, d.model, d.score])).toEqual([
      [0, 'Ay', 7],
      [1, 'Zed', 50],
    ]);
  });
});
