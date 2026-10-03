import { describe, expect, it } from 'vitest';
import {
  emptyReleasesQuery,
  groupByMonth,
  hasReleaseFilters,
  kindFromSlug,
  kindSlug,
  parseReleasesQuery,
  releasesHref,
} from '@/lib/releases/query';
import { RELEASE_KINDS } from '@/types/model';
import type { ReleaseItem } from '@/types/catalog';

const item = (id: string, date: string): ReleaseItem => ({
  id,
  kind: 'MAJOR',
  date,
  title: `Release ${id}`,
  description: 'd',
  announcementUrl: null,
  docsUrl: null,
  provider: { slug: 'p', name: 'P' },
  model: null,
  confirmed: true,
  verificationStatus: 'OFFICIALLY_VERIFIED',
  isDemo: false,
});

describe('release kinds in URLs', () => {
  it('round-trips every kind through its kebab-case slug', () => {
    for (const k of RELEASE_KINDS) expect(kindFromSlug(kindSlug(k))).toBe(k);
    expect(kindSlug('API_CHANGE')).toBe('api-change');
    expect(kindFromSlug('nope')).toBeNull();
    expect(kindFromSlug(undefined)).toBeNull();
  });
});

describe('parseReleasesQuery', () => {
  it('returns the defaults for no parameters', () => {
    expect(parseReleasesQuery({})).toEqual(emptyReleasesQuery);
  });

  it('reads every parameter', () => {
    expect(
      parseReleasesQuery({
        q: ' gemini ',
        provider: 'google-deepmind',
        category: 'api-change',
        from: '2026-01-01',
        to: '2026-09-30',
        view: 'list',
        page: '3',
      }),
    ).toEqual({
      q: 'gemini',
      provider: 'google-deepmind',
      category: 'API_CHANGE',
      from: '2026-01-01',
      to: '2026-09-30',
      view: 'list',
      page: 3,
    });
  });

  it('drops malformed values instead of failing', () => {
    const q = parseReleasesQuery({
      provider: '../x',
      category: 'MAJOR!!',
      from: '2026-02-30',
      to: 'later',
      view: 'grid',
      page: '-4',
    });
    expect(q).toEqual(emptyReleasesQuery);
    expect(parseReleasesQuery({ page: '1.5' }).page).toBe(1);
    expect(parseReleasesQuery({ page: '99999999' }).page).toBe(1);
    expect(parseReleasesQuery({ q: 'x'.repeat(500) }).q).toHaveLength(100);
  });

  it('swaps an inverted date range and takes the first of repeated parameters', () => {
    const q = parseReleasesQuery({ from: '2026-09-30', to: '2026-01-01', provider: ['a', 'b'] });
    expect([q.from, q.to, q.provider]).toEqual(['2026-01-01', '2026-09-30', 'a']);
  });
});

describe('releasesHref and hasReleaseFilters', () => {
  it('leaves out defaults (timeline view, page 1) and empty values', () => {
    expect(releasesHref({})).toBe('/releases');
    expect(releasesHref({ view: 'timeline', page: 1, q: '' })).toBe('/releases');
    expect(
      releasesHref({ view: 'list', page: 2, provider: 'openai', category: 'DEPRECATION' }),
    ).toBe('/releases?provider=openai&category=deprecation&view=list&page=2');
  });

  it('encodes search text', () => {
    expect(releasesHref({ q: 'a&b c' })).toBe('/releases?q=a%26b+c');
  });

  it('counts search, provider, kind and dates as filters, not view or page', () => {
    expect(hasReleaseFilters({ ...emptyReleasesQuery, view: 'list', page: 4 })).toBe(false);
    expect(hasReleaseFilters({ ...emptyReleasesQuery, q: 'x' })).toBe(true);
    expect(hasReleaseFilters({ ...emptyReleasesQuery, to: '2026-01-01' })).toBe(true);
  });
});

describe('groupByMonth', () => {
  it('groups newest-first items under month headings and keeps their order', () => {
    const groups = groupByMonth([
      item('a', '2026-09-29'),
      item('b', '2026-09-01'),
      item('c', '2026-08-31'),
      item('d', '2025-12-02'),
    ]);
    expect(groups.map((g) => [g.key, g.label, g.items.map((i) => i.id)])).toEqual([
      ['2026-09', 'September 2026', ['a', 'b']],
      ['2026-08', 'August 2026', ['c']],
      ['2025-12', 'December 2025', ['d']],
    ]);
  });

  it('is empty for no releases', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
