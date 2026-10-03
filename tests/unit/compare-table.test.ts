import { describe, expect, it } from 'vitest';
import { buildCompareTable } from '@/lib/compare/table';
import { NOT_DISCLOSED } from '@/lib/verification';
import { model, price, result } from './compare-fixtures';

const rowOf = (groups: ReturnType<typeof buildCompareTable>, id: string) =>
  groups.flatMap((g) => g.rows).find((r) => r.id === id)!;

describe('buildCompareTable', () => {
  const a = model('a', { contextWindow: 128_000 });
  const b = model('b', { contextWindow: 128_000 });
  const c = model('c', { contextWindow: null });

  it('has the five groups of the spec, in order, with one cell per model', () => {
    const groups = buildCompareTable([a, b, c]);
    expect(groups.map((g) => g.title)).toEqual([
      'General',
      'Technical',
      'Performance',
      'Pricing',
      'Availability',
    ]);
    for (const r of groups.flatMap((g) => g.rows)) expect(r.cells).toHaveLength(3);
  });

  it('flags rows where the models differ and leaves identical rows alone', () => {
    const groups = buildCompareTable([a, b]);
    expect(rowOf(groups, 'context').differs).toBe(false);
    expect(rowOf(groups, 'provider').differs).toBe(false);
    expect(rowOf(buildCompareTable([a, c]), 'context').differs).toBe(true);
  });

  it('writes "Not publicly disclosed" for a missing value and marks the cell undisclosed', () => {
    const cell = rowOf(buildCompareTable([a, c]), 'context').cells[1]!;
    expect(cell.lines).toEqual([NOT_DISCLOSED]);
    expect(cell.disclosed).toBe(false);
  });

  it('two models that both lack a value do not "differ"', () => {
    const d = model('d', { contextWindow: null });
    expect(rowOf(buildCompareTable([c, d]), 'context').differs).toBe(false);
  });

  it('lists each benchmark on its own row with evaluation type, date and source, never blended', () => {
    const m1 = model('m1', {
      benchmarks: [
        result({ benchmarkSlug: 'x', benchmarkName: 'X', score: 70 }),
        result({ benchmarkSlug: 'y', benchmarkName: 'Y', category: 'coding', score: 40 }),
      ],
    });
    const m2 = model('m2', {
      benchmarks: [result({ benchmarkSlug: 'x', benchmarkName: 'X', score: 65 })],
    });
    const perf = buildCompareTable([m1, m2]).find((g) => g.id === 'performance')!;
    expect(perf.rows.map((r) => r.label).sort()).toEqual(['X', 'Y']);
    const x = perf.rows.find((r) => r.label === 'X')!;
    expect(x.cells[0]!.lines).toEqual(['70%']);
    expect(x.cells[0]!.sub.join(' ')).toMatch(/Provider reported.*1 Sept 2026/);
    expect(x.cells[0]!.href).toBe('https://example.invalid/src');
    const y = perf.rows.find((r) => r.label === 'Y')!;
    expect(y.cells[1]!.lines).toEqual(['No verified data']);
    expect(perf.rows.some((r) => /overall|average|combined|total/i.test(r.label))).toBe(false);
  });

  it('warns when the same benchmark was measured under different conditions', () => {
    const m1 = model('m1', { benchmarks: [result({ evaluationType: 'INDEPENDENT' })] });
    const m2 = model('m2', { benchmarks: [result({ benchmarkVersion: 'v2' })] });
    const row = buildCompareTable([m1, m2]).find((g) => g.id === 'performance')!.rows[0]!;
    expect(row.caveat).toMatch(
      /evaluation types and benchmark versions differ.*not directly comparable/,
    );
    const m3 = model('m3', { benchmarks: [result({ evaluationType: 'INDEPENDENT' })] });
    const same = buildCompareTable([m1, m3]).find((g) => g.id === 'performance')!.rows[0]!;
    expect(same.caveat).toBeNull();
  });

  it('groups benchmark rows under their category', () => {
    const m1 = model('m1', {
      benchmarks: [
        result({ benchmarkSlug: 'x', benchmarkName: 'X', category: 'coding' }),
        result({ benchmarkSlug: 'y', benchmarkName: 'Y', category: 'mathematics' }),
      ],
    });
    const rows = buildCompareTable([m1]).find((g) => g.id === 'performance')!.rows;
    expect(rows.map((r) => r.section)).toEqual(['Coding', 'Mathematics']);
  });

  it('shows every price variant and only adds extra price rows when a model lists them', () => {
    const tiered = model('t', {
      pricing: [
        price({ type: 'INPUT', price: 2, unit: 'per 1M tokens (prompts up to 200K)' }),
        price({ type: 'INPUT', price: 4, unit: 'per 1M tokens (prompts over 200K)' }),
      ],
    });
    const plain = model('p', { pricing: [price({ type: 'INPUT', price: 1 })] });
    const groups = buildCompareTable([tiered, plain]);
    expect(rowOf(groups, 'price-input').cells[0]!.lines).toEqual([
      '2 USD per 1M tokens (prompts up to 200K)',
      '4 USD per 1M tokens (prompts over 200K)',
    ]);
    expect(rowOf(groups, 'price-output').cells[0]!.lines).toEqual([NOT_DISCLOSED]);
    expect(groups.flatMap((g) => g.rows).some((r) => r.id === 'price-batch_input')).toBe(false);
    const batch = model('b', { pricing: [price({ type: 'BATCH_INPUT', price: 0.5 })] });
    const withBatch = buildCompareTable([batch, plain]);
    expect(rowOf(withBatch, 'price-batch_input').cells[0]!.lines[0]).toMatch(/^0.5 USD/);
  });

  it('ignores historical prices', () => {
    const m = model('h', { pricing: [price({ price: 9, isCurrent: false })] });
    expect(rowOf(buildCompareTable([m]), 'price-input').cells[0]!.disclosed).toBe(false);
  });

  it('adds a demo row only when a selected model is demo data', () => {
    const ids = (ms: Parameters<typeof buildCompareTable>[0]) =>
      buildCompareTable(ms).flatMap((g) => g.rows.map((r) => r.id));
    expect(ids([a])).toContain('demo');
    expect(ids([model('r', { isDemo: false })])).not.toContain('demo');
  });
});
