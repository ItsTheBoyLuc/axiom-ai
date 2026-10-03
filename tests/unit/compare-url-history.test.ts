import { describe, expect, it } from 'vitest';
import { MAX_HISTORY, historyKey, parseHistory, pushHistory } from '@/lib/compare/history';
import { compareHrefForSlugs, parseModelsParam } from '@/lib/comparison';

describe('parseModelsParam', () => {
  it('splits, lowercases and de-duplicates', () => {
    expect(parseModelsParam('a, B,a,c')).toEqual({ slugs: ['a', 'b', 'c'], ignored: [] });
  });

  it('keeps at most four and reports the surplus and malformed slugs', () => {
    expect(parseModelsParam('a,b,c,d,e,../x')).toEqual({
      slugs: ['a', 'b', 'c', 'd'],
      ignored: ['e', '../x'],
    });
  });

  it('handles missing, empty, repeated-parameter and hostile input', () => {
    expect(parseModelsParam(undefined)).toEqual({ slugs: [], ignored: [] });
    expect(parseModelsParam('')).toEqual({ slugs: [], ignored: [] });
    expect(parseModelsParam(['a', 'b,c']).slugs).toEqual(['a', 'b', 'c']);
    expect(parseModelsParam('<script>alert(1)</script>').slugs).toEqual([]);
    expect(parseModelsParam('x'.repeat(500)).ignored[0]!.length).toBeLessThanOrEqual(60);
  });

  it('builds the shareable href', () => {
    expect(compareHrefForSlugs(['a', 'b'])).toBe('/compare?models=a,b');
    expect(compareHrefForSlugs([])).toBe('/compare');
  });
});

describe('comparison history', () => {
  const entry = (slugs: string[], at = 1) => ({
    slugs,
    names: slugs.map((s) => s.toUpperCase()),
    at,
  });

  it('puts the newest first and moves a repeated set (any order) to the front', () => {
    let list = pushHistory([], entry(['a', 'b']));
    list = pushHistory(list, entry(['c', 'd']));
    list = pushHistory(list, entry(['b', 'a'], 3));
    expect(list.map((e) => historyKey(e.slugs))).toEqual(['a,b', 'c,d']);
  });

  it('ignores sets of fewer than two and caps the list', () => {
    expect(pushHistory([], entry(['a']))).toEqual([]);
    let list: ReturnType<typeof parseHistory> = [];
    for (let i = 0; i < MAX_HISTORY + 4; i++) list = pushHistory(list, entry([`a${i}`, `b${i}`]));
    expect(list).toHaveLength(MAX_HISTORY);
  });

  it('parses stored JSON defensively', () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory('not json')).toEqual([]);
    expect(parseHistory('{"a":1}')).toEqual([]);
    expect(parseHistory(JSON.stringify([{ slugs: ['a'], names: ['A'], at: 1 }]))).toEqual([]);
    expect(parseHistory(JSON.stringify([entry(['a', 'b']), entry(['b', 'a'])]))).toHaveLength(1);
  });
});
