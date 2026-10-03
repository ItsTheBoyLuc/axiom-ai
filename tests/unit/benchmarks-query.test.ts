import { describe, expect, it } from 'vitest';
import { emptyQuery, explorerHref, hasFilters, parseExplorerQuery } from '@/lib/benchmarks/query';

describe('parseExplorerQuery', () => {
  it('reads every supported parameter', () => {
    const q = parseExplorerQuery({
      category: 'coding',
      benchmark: 'deepswe-1-1',
      provider: 'openai',
      family: 'GPT-6',
      version: 'gpt-6-sol',
      type: 'PROVIDER_REPORTED',
      from: '2026-06-01',
      to: '2026-09-30',
    });
    expect(q).toEqual({
      category: 'coding',
      benchmark: 'deepswe-1-1',
      provider: 'openai',
      family: 'GPT-6',
      version: 'gpt-6-sol',
      type: 'PROVIDER_REPORTED',
      from: '2026-06-01',
      to: '2026-09-30',
    });
  });

  it('returns an empty query for no parameters', () => {
    expect(parseExplorerQuery({})).toEqual(emptyQuery);
  });

  it('drops unknown or malformed values instead of failing', () => {
    const q = parseExplorerQuery({
      category: 'not-a-category',
      benchmark: 'Not A Slug!',
      provider: '../etc',
      type: 'GUESSED',
      from: '2026-13-45',
      to: 'yesterday',
      family: 'x'.repeat(500),
    });
    expect(q).toEqual(emptyQuery);
  });

  it('rejects impossible calendar dates', () => {
    expect(parseExplorerQuery({ from: '2026-02-30' }).from).toBeNull();
    expect(parseExplorerQuery({ from: '2026-02-28' }).from).toBe('2026-02-28');
  });

  it('swaps an inverted date range', () => {
    const q = parseExplorerQuery({ from: '2026-09-30', to: '2026-06-01' });
    expect([q.from, q.to]).toEqual(['2026-06-01', '2026-09-30']);
  });

  it('uses the first value of a repeated parameter and trims text', () => {
    expect(parseExplorerQuery({ provider: ['openai', 'google'] }).provider).toBe('openai');
    expect(parseExplorerQuery({ family: '  Gemini Flash ' }).family).toBe('Gemini Flash');
  });
});

describe('explorerHref and hasFilters', () => {
  it('omits empty values and keeps the rest', () => {
    expect(explorerHref({})).toBe('/benchmarks');
    expect(explorerHref({ category: null, benchmark: 'a-b', provider: null })).toBe(
      '/benchmarks?benchmark=a-b',
    );
    expect(explorerHref({ category: 'coding', benchmark: 'x', from: '2026-01-01' })).toBe(
      '/benchmarks?category=coding&benchmark=x&from=2026-01-01',
    );
  });

  it('encodes values safely', () => {
    expect(explorerHref({ family: 'A&B=C' })).toBe('/benchmarks?family=A%26B%3DC');
  });

  it('counts only result filters, not category or benchmark', () => {
    expect(hasFilters({ ...emptyQuery, category: 'coding', benchmark: 'x' })).toBe(false);
    expect(hasFilters({ ...emptyQuery, type: 'INDEPENDENT' })).toBe(true);
    expect(hasFilters({ ...emptyQuery, to: '2026-01-01' })).toBe(true);
  });
});
