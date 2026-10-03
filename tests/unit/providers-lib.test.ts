import { describe, expect, it } from 'vitest';
import { axisTicks, kindShape, layoutTimeline, MAX_LANES } from '@/lib/providers/timeline';
import {
  availabilityGroups,
  emptyPortfolioFilter,
  filterPortfolio,
  modalitySummary,
} from '@/lib/providers/profile';
import {
  filterProviders,
  orgTypeFacets,
  orgTypeText,
  pageOf,
  parseProvidersQuery,
  providersHref,
} from '@/lib/providers/query';
import { RELEASE_KINDS } from '@/types/model';
import type { ProviderSummary, ReleaseItem } from '@/types/catalog';
import { model } from './compare-fixtures';

const provider = (over: Partial<ProviderSummary> = {}): ProviderSummary => ({
  slug: 'p',
  name: 'Provider',
  monogram: 'P',
  description: 'Builds models.',
  tier: 'listed',
  officialWebsite: null,
  headquarters: null,
  orgType: 'COMPANY',
  modelCount: 1,
  latestRelease: null,
  verificationStatus: 'OFFICIALLY_VERIFIED',
  isDemo: false,
  ...over,
});

const release = (id: string, date: string, over: Partial<ReleaseItem> = {}): ReleaseItem => ({
  id,
  kind: 'MAJOR',
  date,
  title: `R ${id}`,
  description: 'd',
  announcementUrl: null,
  docsUrl: null,
  provider: { slug: 'p', name: 'P' },
  model: null,
  confirmed: true,
  verificationStatus: 'OFFICIALLY_VERIFIED',
  isDemo: false,
  ...over,
});

describe('provider directory query', () => {
  it('parses q, type and page tolerantly', () => {
    expect(parseProvidersQuery({ q: ' open ', type: 'research_lab', page: '2' })).toEqual({
      q: 'open',
      type: 'RESEARCH_LAB',
      page: 2,
    });
    expect(parseProvidersQuery({ type: '../etc', page: '0' })).toEqual({
      q: '',
      type: null,
      page: 1,
    });
    expect(parseProvidersQuery({})).toEqual({ q: '', type: null, page: 1 });
  });

  it('builds hrefs without defaults', () => {
    expect(providersHref({})).toBe('/providers');
    expect(providersHref({ q: 'x', type: 'COMPANY', page: 2 })).toBe(
      '/providers?q=x&type=company&page=2',
    );
  });

  it('labels org types, with a readable fallback', () => {
    expect(orgTypeText('RESEARCH_LAB')).toBe('Research lab');
    expect(orgTypeText('SOMETHING_NEW')).toBe('Something new');
  });
});

describe('filterProviders, facets and paging', () => {
  const all = [
    provider({
      slug: 'a',
      name: 'Alpha Labs',
      description: 'Builds language models',
      orgType: 'RESEARCH_LAB',
    }),
    provider({ slug: 'b', name: 'Béta', description: 'Speech and audio' }),
    provider({ slug: 'c', name: 'Gamma', description: 'Open weights language models' }),
  ];
  const slugs = (q: Partial<ReturnType<typeof parseProvidersQuery>>) =>
    filterProviders(all, { q: '', type: null, page: 1, ...q }).map((p) => p.slug);

  it('matches every search token in name, description or org type, ignoring case and accents', () => {
    expect(slugs({ q: 'language' })).toEqual(['a', 'c']);
    expect(slugs({ q: 'language open' })).toEqual(['c']);
    expect(slugs({ q: 'beta' })).toEqual(['b']);
    expect(slugs({ q: 'research lab' })).toEqual(['a']);
    expect(slugs({ q: 'nothing like this' })).toEqual([]);
  });

  it('filters by organisation type', () => {
    expect(slugs({ type: 'RESEARCH_LAB' })).toEqual(['a']);
    expect(slugs({ type: 'COMPANY', q: 'language' })).toEqual(['c']);
  });

  it('counts organisation types alphabetically by label', () => {
    expect(orgTypeFacets(all)).toEqual([
      { type: 'COMPANY', count: 2 },
      { type: 'RESEARCH_LAB', count: 1 },
    ]);
  });

  it('pages in memory and clamps an out-of-range page', () => {
    const many = Array.from({ length: 5 }, (_, i) => i);
    expect(pageOf(many, 2, 2)).toEqual({ items: [2, 3], page: 2, pageCount: 3 });
    expect(pageOf(many, 99, 2)).toEqual({ items: [4], page: 3, pageCount: 3 });
    expect(pageOf([], 1, 2)).toEqual({ items: [], page: 1, pageCount: 1 });
  });
});

describe('layoutTimeline', () => {
  it('is empty without releases', () => {
    expect(layoutTimeline([])).toMatchObject({ points: [], ticks: [], from: null, to: null });
  });

  it('places releases along the axis in date order within 0..1', () => {
    const { points, from, to } = layoutTimeline([
      release('late', '2026-09-01'),
      release('early', '2026-01-01'),
      release('mid', '2026-05-01'),
    ]);
    expect(points.map((p) => p.id)).toEqual(['early', 'mid', 'late']);
    expect(points[0]!.x).toBeLessThan(points[1]!.x);
    expect(points[1]!.x).toBeLessThan(points[2]!.x);
    expect(points.every((p) => p.x > 0 && p.x < 1)).toBe(true);
    expect([from, to]).toEqual(['2026-01-01', '2026-09-01']);
  });

  it('puts one release (or releases on one day) mid-axis, in separate lanes when they collide', () => {
    expect(layoutTimeline([release('a', '2026-05-01')]).points[0]).toMatchObject({
      x: 0.5,
      lane: 0,
    });
    const same = layoutTimeline([release('a', '2026-05-01'), release('b', '2026-05-01')]).points;
    expect(same.map((p) => p.lane)).toEqual([0, 1]);
  });

  it('never needs more than the maximum lanes, even for a burst of releases', () => {
    const burst = Array.from({ length: 12 }, (_, i) => release(`r${i}`, '2026-05-01'));
    const { points, lanes } = layoutTimeline(burst);
    expect(lanes).toBeLessThanOrEqual(MAX_LANES);
    expect(Math.max(...points.map((p) => p.lane))).toBeLessThan(MAX_LANES);
  });

  it('re-uses a lane once the previous marker is far enough away', () => {
    const { points } = layoutTimeline([release('a', '2026-01-01'), release('b', '2026-09-01')]);
    expect(points.map((p) => p.lane)).toEqual([0, 0]);
  });

  it('carries confirmation and kind through, and every kind has a marker shape', () => {
    const { points } = layoutTimeline([
      release('a', '2026-01-01', { confirmed: false, kind: 'DEPRECATION' }),
    ]);
    expect(points[0]).toMatchObject({ confirmed: false, kind: 'DEPRECATION' });
    for (const k of RELEASE_KINDS) expect(kindShape[k]).toBeTruthy();
  });
});

describe('axisTicks', () => {
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
  it('uses weekly ticks for a span of a few weeks', () => {
    const ticks = axisTicks(t('2026-08-21'), t('2026-09-29'));
    expect(ticks.length).toBeGreaterThanOrEqual(5);
    expect(ticks[0]!.label).toBe('21 Aug');
  });
  it('uses month ticks for a few months and quarter ticks for longer spans', () => {
    expect(axisTicks(t('2026-02-10'), t('2026-09-10')).map((x) => x.label)).toEqual([
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sept',
    ]);
    const quarters = axisTicks(t('2025-01-15'), t('2026-09-10')).map((x) => x.label);
    expect(quarters).toEqual(['Apr 25', 'Jul 25', 'Oct 25', 'Jan 26', 'Apr 26', 'Jul 26']);
  });
});

describe('profile helpers', () => {
  const models = [
    model('a', {
      modalities: ['text', 'image'],
      availability: 'Cloud API',
      categories: ['llm', 'coding'],
      openWeights: false,
      name: 'Alpha One',
    }),
    model('b', {
      modalities: ['text'],
      availability: 'Open weights',
      categories: ['llm'],
      openWeights: true,
      name: 'Beta Two',
      family: 'Beta',
    }),
    model('c', {
      modalities: ['text', 'audio'],
      availability: 'Cloud API',
      categories: ['audio'],
      openWeights: false,
      name: 'Gamma',
    }),
  ];

  it('counts modalities by how many models support them', () => {
    expect(modalitySummary(models).map((m) => [m.label, m.models])).toEqual([
      ['Text', 3],
      ['Audio', 1],
      ['Image', 1],
    ]);
  });

  it('groups models by how they are accessed, largest group first', () => {
    expect(availabilityGroups(models).map((g) => [g.availability, g.models.length])).toEqual([
      ['Cloud API', 2],
      ['Open weights', 1],
    ]);
  });

  it('filters the portfolio by text, category, availability and open weights', () => {
    const names = (f: Partial<typeof emptyPortfolioFilter>) =>
      filterPortfolio(models, { ...emptyPortfolioFilter, ...f }).map((m) => m.name);
    expect(names({})).toEqual(['Alpha One', 'Beta Two', 'Gamma']);
    expect(names({ q: 'beta' })).toEqual(['Beta Two']);
    expect(names({ category: 'llm' })).toEqual(['Alpha One', 'Beta Two']);
    expect(names({ availability: 'Cloud API', category: 'audio' })).toEqual(['Gamma']);
    expect(names({ openWeightsOnly: true })).toEqual(['Beta Two']);
    expect(names({ q: 'zzz' })).toEqual([]);
  });
});
