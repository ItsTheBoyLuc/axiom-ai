import { describe, expect, it } from 'vitest';
import {
  MAX_COMPARE,
  MAX_RECENT,
  compareHref,
  parseRefs,
  pushRecent,
  toggleSelection,
  type ModelRef,
} from '@/lib/comparison';
import { MATRIX_ROWS, buildCapabilityMatrix } from '@/lib/models/capability-matrix';
import { demoModelDetails } from '../../server/repositories/demo/models';

const ref = (n: number): ModelRef => ({ slug: `m-${n}`, name: `Model ${n}`, providerName: 'P' });

describe('comparison selection', () => {
  it('adds and removes models', () => {
    const a = toggleSelection([], ref(1));
    expect(a).toEqual({ list: [ref(1)], ok: true });
    expect(toggleSelection(a.list, ref(1))).toEqual({ list: [], ok: true });
  });

  it('refuses a fifth model instead of dropping one silently', () => {
    let list: ModelRef[] = [];
    for (let i = 1; i <= MAX_COMPARE; i++) list = toggleSelection(list, ref(i)).list;
    const r = toggleSelection(list, ref(5));
    expect(r.ok).toBe(false);
    expect(r.list).toHaveLength(MAX_COMPARE);
    // Removing is always allowed, even when full.
    expect(toggleSelection(list, ref(2)).ok).toBe(true);
  });

  it('builds a shareable compare URL', () => {
    expect(compareHref([ref(1), ref(2)])).toBe('/compare?models=m-1,m-2');
  });
});

describe('stored lists', () => {
  it('parses valid JSON, de-duplicates and caps', () => {
    const raw = JSON.stringify([ref(1), ref(1), ref(2), ref(3)]);
    expect(parseRefs(raw, 2)).toEqual([ref(1), ref(2)]);
  });

  it.each([null, '', 'not json', '{"a":1}', '[1,2,3]', '[{"slug":1}]'])(
    'returns [] for malformed input %j',
    (raw) => {
      expect(parseRefs(raw, 4)).toEqual([]);
    },
  );

  it('recently viewed is most-recent-first, de-duplicated and capped', () => {
    let list: ModelRef[] = [];
    for (let i = 1; i <= MAX_RECENT + 3; i++) list = pushRecent(list, ref(i));
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]).toEqual(ref(MAX_RECENT + 3));
    const bumped = pushRecent(list, ref(MAX_RECENT + 1));
    expect(bumped[0]).toEqual(ref(MAX_RECENT + 1));
    expect(bumped.filter((m) => m.slug === ref(MAX_RECENT + 1).slug)).toHaveLength(1);
  });
});

describe('capability matrix', () => {
  it('always has the eight required rows', () => {
    expect(MATRIX_ROWS.map((r) => r.label)).toEqual([
      'Reasoning',
      'Coding',
      'Mathematics',
      'Multimodal',
      'Long-context',
      'Tool use',
      'Instruction following',
      'Creative writing',
    ]);
    expect(buildCapabilityMatrix([])).toHaveLength(8);
  });

  it('fills cells only from real benchmark evidence, newest first', () => {
    const m2 = demoModelDetails.find((m) => m.slug === 'sample-model-2')!;
    const rows = buildCapabilityMatrix(m2.benchmarks);
    const reasoning = rows.find((r) => r.key === 'reasoning')!;
    expect(reasoning.evidence.map((e) => e.score)).toEqual([74, 78]);
    expect(rows.find((r) => r.key === 'coding')!.evidence).toEqual([]);
    // Rows without a matching benchmark category stay empty ("No verified data").
    expect(rows.find((r) => r.key === 'creative-writing')!.evidence).toEqual([]);
  });

  it('leaves every row empty for a model with no benchmarks', () => {
    const none = demoModelDetails.find((m) => m.benchmarks.length === 0)!;
    expect(buildCapabilityMatrix(none.benchmarks).every((r) => r.evidence.length === 0)).toBe(true);
  });
});
