import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  activeFilterCount,
  defaultQuery,
  parseModelQuery,
  toSearchParams,
} from '@/lib/models/query';

const p = (s: string) => parseModelQuery(new URLSearchParams(s));

describe('parseModelQuery', () => {
  it('returns defaults for an empty query string', () => {
    expect(p('')).toEqual(defaultQuery);
  });

  it('parses comma-separated multi-select filters', () => {
    const q = p(
      'provider=demo-provider-a,other&category=coding,llm&capability=reasoning&deployment=local&pricing=free,paid',
    );
    expect(q.provider).toEqual(['demo-provider-a', 'other']);
    expect(q.category).toEqual(['coding', 'llm']);
    expect(q.capability).toEqual(['reasoning']);
    expect(q.deployment).toEqual(['local']);
    expect(q.pricing).toEqual(['free', 'paid']);
  });

  it('drops unknown enum values and de-duplicates', () => {
    const q = p('category=coding,nope,coding&pricing=cheap&provider=Bad Slug!,ok-slug');
    expect(q.category).toEqual(['coding']);
    expect(q.pricing).toEqual([]);
    expect(q.provider).toEqual(['ok-slug']);
  });

  it('falls back to the default sort for unknown values', () => {
    expect(p('sort=random').sort).toBe('recent');
    expect(p('sort=alpha').sort).toBe('alpha');
  });

  it('requires a benchmark for benchmark sorting', () => {
    expect(p('sort=benchmark').sort).toBe('recent');
    const q = p('sort=benchmark&benchmark=sample-benchmark-1');
    expect(q.sort).toBe('benchmark');
    expect(q.benchmark).toBe('sample-benchmark-1');
  });

  it('clamps and validates paging', () => {
    expect(p('page=0').page).toBe(1);
    expect(p('page=abc').page).toBe(1);
    expect(p('page=-3').page).toBe(1);
    expect(p('page=3').page).toBe(3);
    expect(p('pageSize=9999').pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(p(`pageSize=${MAX_PAGE_SIZE}`).pageSize).toBe(MAX_PAGE_SIZE);
    expect(p('pageSize=1').pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it('trims and length-limits the search string', () => {
    expect(p('q=%20%20hello%20').q).toBe('hello');
    expect(p('q=' + 'x'.repeat(500)).q).toHaveLength(100);
  });

  it('accepts Next.js searchParams objects (string or string[])', () => {
    const q = parseModelQuery({ q: ['first', 'second'], category: 'coding', page: '2' });
    expect(q.q).toBe('first');
    expect(q.category).toEqual(['coding']);
    expect(q.page).toBe(2);
  });
});

describe('toSearchParams', () => {
  it('omits defaults', () => {
    expect(toSearchParams(defaultQuery).toString()).toBe('');
  });

  it('produces canonical (sorted) lists', () => {
    const s = toSearchParams({ category: ['llm', 'coding'] });
    expect(s.get('category')).toBe('coding,llm');
  });

  it('round-trips a full query', () => {
    const original = p(
      'q=sample&provider=demo-provider-a,other&category=coding&capability=reasoning,tool-calling&deployment=local&pricing=paid&sort=benchmark&benchmark=sample-benchmark-2&page=2&pageSize=6',
    );
    expect(parseModelQuery(toSearchParams(original))).toEqual(original);
  });

  it('only writes the benchmark param when sorting by benchmark', () => {
    const s = toSearchParams({ sort: 'alpha', benchmark: 'sample-benchmark-1' });
    expect(s.has('benchmark')).toBe(false);
  });
});

describe('activeFilterCount', () => {
  it('counts filter values but not search or sort', () => {
    expect(activeFilterCount(p('q=x&sort=alpha'))).toBe(0);
    expect(activeFilterCount(p('category=coding,llm&pricing=free'))).toBe(3);
  });
});
