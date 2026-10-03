import { describe, expect, it } from 'vitest';
import {
  categoryFromSlug,
  categorySlug,
  emptyNewsQuery,
  hasNewsFilters,
  newsHref,
  parseNewsQuery,
  sourceFlag,
} from '@/lib/news/query';
import {
  cleanQuery,
  groupHits,
  isExternalHref,
  parseTypes,
  searchHref,
  totalHits,
  typeSearchHref,
} from '@/lib/search/model';
import { MAX_RECENT_SEARCHES, parseRecent, pushRecentSearch } from '@/lib/search/recent';
import { NEWS_CATEGORIES, SEARCH_TYPES, type SearchHit, type SearchResults } from '@/types/catalog';

describe('news URL state', () => {
  it('round-trips every category through its slug', () => {
    for (const c of NEWS_CATEGORIES) expect(categoryFromSlug(categorySlug(c))).toBe(c);
    expect(categorySlug('MODEL_RELEASES')).toBe('model-releases');
    expect(categoryFromSlug('nope')).toBeNull();
  });

  it('returns the defaults for no parameters and reads every parameter', () => {
    expect(parseNewsQuery({})).toEqual(emptyNewsQuery);
    expect(
      parseNewsQuery({
        tab: 'research',
        q: ' open weights ',
        category: 'hardware',
        provider: 'nvidia',
        source: 'official',
        page: '3',
      }),
    ).toEqual({
      tab: 'research',
      q: 'open weights',
      category: 'HARDWARE',
      provider: 'nvidia',
      source: 'official',
      page: 3,
    });
  });

  it('drops malformed values instead of failing', () => {
    expect(
      parseNewsQuery({
        tab: 'x',
        category: '<b>',
        provider: '../etc',
        source: 'rumour',
        page: '-2',
        q: 'x'.repeat(300),
      }),
    ).toEqual({ ...emptyNewsQuery, q: 'x'.repeat(100) });
    expect(parseNewsQuery({ page: '1.5' }).page).toBe(1);
  });

  it('builds hrefs without defaults and counts only real filters', () => {
    expect(newsHref({})).toBe('/news');
    expect(newsHref({ tab: 'news', page: 1 })).toBe('/news');
    expect(newsHref({ tab: 'research', category: 'SAFETY', source: 'independent', page: 2 })).toBe(
      '/news?tab=research&category=safety&source=independent&page=2',
    );
    expect(hasNewsFilters({ ...emptyNewsQuery, tab: 'research', page: 4 })).toBe(false);
    expect(hasNewsFilters({ ...emptyNewsQuery, source: 'official' })).toBe(true);
  });

  it('maps the source to the repository flag', () => {
    expect(sourceFlag('official')).toBe(true);
    expect(sourceFlag('independent')).toBe(false);
    expect(sourceFlag(null)).toBeUndefined();
  });
});

const hit = (type: SearchHit['type'], id: string, href = `/x/${id}`): SearchHit => ({
  type,
  id,
  title: id,
  subtitle: null,
  href,
  isDemo: false,
});
const results = (over: Partial<SearchResults['results']> = {}): SearchResults['results'] => ({
  models: [],
  providers: [],
  benchmarks: [],
  releases: [],
  news: [],
  research: [],
  ...over,
});

describe('search model', () => {
  it('cleans the query: trimmed and capped', () => {
    expect(cleanQuery('  gemini  ')).toBe('gemini');
    expect(cleanQuery('x'.repeat(500))).toHaveLength(100);
  });

  it('builds the full-results URL, leaving out empty text and the all-types default', () => {
    expect(searchHref('')).toBe('/search');
    expect(searchHref('gpt 6')).toBe('/search?q=gpt+6');
    expect(searchHref('gpt', ['models'])).toBe('/search?q=gpt&types=models');
    expect(searchHref('gpt', ['models', 'news'])).toBe('/search?q=gpt&types=models%2Cnews');
    expect(searchHref('gpt', [...SEARCH_TYPES])).toBe('/search?q=gpt');
  });

  it('parses types: valid only, unique, in canonical order', () => {
    expect(parseTypes('news,models,bogus,models')).toEqual(['models', 'news']);
    expect(parseTypes(['research', 'providers'])).toEqual(['providers', 'research']);
    expect(parseTypes(undefined)).toEqual([]);
  });

  it('treats only http(s) links as external', () => {
    expect(isExternalHref('https://example.invalid/a')).toBe(true);
    expect(isExternalHref('HTTP://example.invalid/a')).toBe(true);
    expect(isExternalHref('/models/x')).toBe(false);
    expect(isExternalHref('javascript:alert(1)')).toBe(false);
  });

  it('groups hits in the canonical type order, skipping empty types', () => {
    const r = results({
      news: [hit('news', 'n1', 'https://e.invalid/n')],
      models: [hit('models', 'm1'), hit('models', 'm2')],
    });
    const g = groupHits(r);
    expect(g.map((x) => [x.type, x.label, x.hits.length])).toEqual([
      ['models', 'Models', 2],
      ['news', 'News', 1],
    ]);
    expect(totalHits(r)).toBe(3);
    expect(groupHits(results())).toEqual([]);
  });

  it('has a "view all" destination for every type that has its own search', () => {
    expect(typeSearchHref.models!('a b')).toBe('/models?q=a%20b');
    expect(typeSearchHref.research!('x')).toBe('/news?tab=research&q=x');
    expect(typeSearchHref.benchmarks).toBeUndefined();
  });
});

describe('recent searches', () => {
  it('puts the newest first and moves a repeat (any case) to the front', () => {
    let list = pushRecentSearch([], 'gemini');
    list = pushRecentSearch(list, 'claude');
    list = pushRecentSearch(list, 'Gemini');
    expect(list).toEqual(['Gemini', 'claude']);
  });

  it('ignores one-character queries and caps the list', () => {
    expect(pushRecentSearch(['a'], 'b')).toEqual(['a']);
    let list: string[] = [];
    for (let i = 0; i < MAX_RECENT_SEARCHES + 3; i++) list = pushRecentSearch(list, `query ${i}`);
    expect(list).toHaveLength(MAX_RECENT_SEARCHES);
    expect(list[0]).toBe(`query ${MAX_RECENT_SEARCHES + 2}`);
  });

  it('parses stored JSON defensively', () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent('not json')).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
    expect(parseRecent(JSON.stringify(['ok', 5, null, 'OK', ' padded ']))).toEqual([
      'ok',
      'padded',
    ]);
  });
});
