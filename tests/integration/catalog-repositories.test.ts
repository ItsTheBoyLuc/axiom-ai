import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRepositories } from '../../server/repositories';
import { newDb, seedDemo } from './helpers';

const db = newDb();
const repos = createRepositories(db);

beforeAll(async () => {
  await seedDemo(db);
  const a = await db.provider.findUniqueOrThrow({
    where: { slug: 'demo-provider-a' },
    select: { id: true },
  });
  await db.publication.create({
    data: {
      providerId: a.id,
      title: 'A demo research paper about sample efficiency',
      url: 'https://example.invalid/demo/paper',
      publishedAt: new Date('2026-05-01'),
      venue: 'Demo Venue',
      isDemo: true,
      dataType: 'demo',
    },
  });
});
afterAll(() => db.$disconnect());

describe('providers', () => {
  it('lists every provider with model counts, marking non-listed ones as "other"', async () => {
    const all = await repos.providers.listAll();
    expect(all).toHaveLength(7);
    expect(all.reduce((n, p) => n + p.modelCount, 0)).toBe(16);
    expect(all.map((p) => p.name)).toEqual([...all.map((p) => p.name)].sort());
    expect(all.find((p) => p.slug === 'demo-provider-g')).toMatchObject({
      tier: 'other',
      monogram: 'G',
      modelCount: 2,
    });
    expect(all.find((p) => p.slug === 'demo-provider-a')).toMatchObject({
      tier: 'listed',
      isDemo: true,
    });
  });

  it('paginates and searches (every token must match)', async () => {
    const page = await repos.providers.list({ page: 1, pageSize: 3 });
    expect(page).toMatchObject({ total: 7, pageCount: 3, page: 1 });
    expect(page.items).toHaveLength(3);
    expect((await repos.providers.list({ page: 99, pageSize: 3 })).page).toBe(3); // clamped
    const hit = await repos.providers.list({ q: 'provider g', page: 1, pageSize: 10 });
    expect(hit.items.map((p) => p.slug)).toEqual(['demo-provider-g']);
    expect((await repos.providers.list({ q: 'zzz', page: 1, pageSize: 10 })).total).toBe(0);
    expect((await repos.providers.list({ q: '%', page: 1, pageSize: 10 })).total).toBe(0);
  });

  it('returns a profile with models, releases and publications', async () => {
    const p = (await repos.providers.getBySlug('demo-provider-a'))!;
    expect(p.models.map((m) => m.slug).sort()).toEqual([
      'sample-model-1',
      'sample-model-7',
      'sample-model-8',
    ]);
    expect(p.releases.length).toBeGreaterThan(0);
    expect(p.releases.length).toBeLessThanOrEqual(10);
    expect(p.releases.map((r) => r.date)).toEqual(
      [...p.releases.map((r) => r.date)].sort().reverse(),
    );
    expect(p.publications).toEqual([
      {
        title: 'A demo research paper about sample efficiency',
        url: 'https://example.invalid/demo/paper',
        publishedAt: '2026-05-01',
        venue: 'Demo Venue',
      },
    ]);
    expect(await repos.providers.getBySlug('nobody')).toBeNull();
  });
});

describe('benchmarks', () => {
  it('lists benchmarks with result counts', async () => {
    const list = await repos.benchmarks.list();
    expect(list).toHaveLength(5);
    expect(list.reduce((n, b) => n + b.resultCount, 0)).toBe(21);
    expect(list.find((b) => b.slug === 'sample-benchmark-1')).toMatchObject({
      category: 'reasoning',
      isDemo: true,
    });
  });

  it('aggregates per benchmark (models, latest date, evaluation mix, units) agree with its results', async () => {
    const list = await repos.benchmarks.list();
    for (const b of list) {
      const { items } = await repos.benchmarks.results({
        benchmark: b.slug,
        page: 1,
        pageSize: 100,
      });
      expect(b.resultCount, b.slug).toBe(items.length);
      expect(b.modelCount, b.slug).toBe(new Set(items.map((r) => r.model.slug)).size);
      expect(b.latestDate, b.slug).toBe(
        items
          .map((r) => r.evaluationDate)
          .sort()
          .pop() ?? null,
      );
      expect(b.units, b.slug).toEqual([...new Set(items.map((r) => r.scoreUnit))].sort());
      expect(b.byType, b.slug).toEqual({
        INDEPENDENT: items.filter((r) => r.evaluationType === 'INDEPENDENT').length,
        PROVIDER_REPORTED: items.filter((r) => r.evaluationType === 'PROVIDER_REPORTED').length,
        COMMUNITY: items.filter((r) => r.evaluationType === 'COMMUNITY').length,
      });
    }
    // The demo fixtures include at least one benchmark with several models and mixed types.
    expect(list.some((b) => b.modelCount > 1)).toBe(true);
    expect(list.some((b) => b.byType.INDEPENDENT > 0 && b.byType.PROVIDER_REPORTED > 0)).toBe(true);
  });

  it('filters results without ever merging them', async () => {
    const b1 = await repos.benchmarks.results({
      benchmark: 'sample-benchmark-1',
      page: 1,
      pageSize: 50,
    });
    expect(b1.total).toBeGreaterThan(3);
    expect(b1.items.every((r) => r.benchmarkSlug === 'sample-benchmark-1')).toBe(true);
    // newest first
    expect(b1.items.map((r) => r.evaluationDate)).toEqual(
      [...b1.items.map((r) => r.evaluationDate)].sort().reverse(),
    );
    // both results for Sample Model 2 are present as separate rows
    expect(b1.items.filter((r) => r.model.slug === 'sample-model-2')).toHaveLength(2);

    const byProvider = await repos.benchmarks.results({
      provider: 'demo-provider-d',
      page: 1,
      pageSize: 50,
    });
    expect(byProvider.items.every((r) => r.provider.slug === 'demo-provider-d')).toBe(true);

    const family = await repos.benchmarks.results({
      family: 'sample family w',
      page: 1,
      pageSize: 50,
    });
    expect(family.total).toBeGreaterThan(0);
    expect(family.items.every((r) => r.model.family === 'Sample Family W')).toBe(true);

    const version = await repos.benchmarks.results({ version: '3.5', page: 1, pageSize: 50 });
    expect(version.items.every((r) => r.modelVersion === '3.5')).toBe(true);

    const range = await repos.benchmarks.results({
      from: '2026-08-01',
      to: '2026-09-30',
      page: 1,
      pageSize: 50,
    });
    expect(range.total).toBeGreaterThan(0);
    for (const r of range.items) {
      expect(r.evaluationDate >= '2026-08-01' && r.evaluationDate <= '2026-09-30').toBe(true);
    }
  });

  it('paginates results and reports honest totals', async () => {
    const all = await repos.benchmarks.results({ page: 1, pageSize: 100 });
    expect(all.total).toBe(21);
    const p2 = await repos.benchmarks.results({ page: 2, pageSize: 10 });
    expect(p2).toMatchObject({ total: 21, pageCount: 3, page: 2 });
    expect(p2.items).toHaveLength(10);
    expect(
      (await repos.benchmarks.results({ benchmark: 'nope', page: 1, pageSize: 10 })).total,
    ).toBe(0);
  });

  it('every row keeps its own evaluation type, version, methodology and source fields', async () => {
    const [r] = (await repos.benchmarks.results({ page: 1, pageSize: 1 })).items;
    expect(r).toMatchObject({
      evaluationType: expect.stringMatching(/INDEPENDENT|PROVIDER_REPORTED|COMMUNITY/),
      modelVersion: expect.any(String),
      scoreUnit: '%',
      isDemo: true,
    });
    expect(r).toHaveProperty('methodologyNotes');
    expect(r).toHaveProperty('sourceUrl');
    expect(r).toHaveProperty('benchmarkVersion');
  });
});

describe('releases', () => {
  it('filters by kind, provider, date range and text, newest first', async () => {
    const all = await repos.releases.list({ page: 1, pageSize: 100 });
    expect(all.total).toBe(20);
    expect(all.items.map((r) => r.date)).toEqual(
      [...all.items.map((r) => r.date)].sort().reverse(),
    );

    const major = await repos.releases.list({ category: 'MAJOR', page: 1, pageSize: 100 });
    expect(major.total).toBe(16);
    expect(major.items.every((r) => r.kind === 'MAJOR')).toBe(true);

    const dep = await repos.releases.list({ category: 'DEPRECATION', page: 1, pageSize: 100 });
    expect(dep.total).toBe(2);

    const byProvider = await repos.releases.list({
      provider: 'demo-provider-b',
      page: 1,
      pageSize: 100,
    });
    expect(byProvider.items.every((r) => r.provider.slug === 'demo-provider-b')).toBe(true);

    const range = await repos.releases.list({ from: '2026-08-01', page: 1, pageSize: 100 });
    expect(range.items.every((r) => r.date >= '2026-08-01')).toBe(true);
    expect(
      (await repos.releases.list({ from: '2026-08-01', to: '2026-07-01', page: 1, pageSize: 5 }))
        .total,
    ).toBe(0);

    const text = await repos.releases.list({ q: 'deprecation notice', page: 1, pageSize: 100 });
    expect(text.total).toBe(2);
  });

  it('marks demo/unverified releases as NOT confirmed', async () => {
    const { items } = await repos.releases.list({ page: 1, pageSize: 100 });
    expect(items.every((r) => r.confirmed === false)).toBe(true);
    expect(items.every((r) => r.isDemo)).toBe(true);
    expect(items[0]!.model).toMatchObject({ slug: expect.any(String) });
  });
});

describe('news', () => {
  it('lists articles newest first with their flags', async () => {
    const { items, total } = await repos.news.list({ page: 1, pageSize: 10 });
    expect(total).toBe(3);
    expect(items.map((n) => n.publishedAt.slice(0, 10))).toEqual([
      '2026-03-02',
      '2026-02-20',
      '2026-02-10',
    ]);
    expect(items[0]).toMatchObject({
      isOfficial: true,
      isAiSummary: false,
      isDemo: true,
      category: 'MODEL_RELEASES',
    });
    expect(items[1]).toMatchObject({ isOfficial: false, isAiSummary: true });
    expect(items[0]!.url).toMatch(/^https:\/\/example\.invalid\//);
  });

  it('filters by category, provider and text', async () => {
    expect(
      (await repos.news.list({ category: 'RESEARCH', page: 1, pageSize: 10 })).items.map(
        (n) => n.title,
      ),
    ).toEqual(['Sample headline: research note']);
    expect(
      (await repos.news.list({ provider: 'demo-provider-b', page: 1, pageSize: 10 })).total,
    ).toBe(1);
    expect(
      (await repos.news.list({ q: 'independent reporting', page: 1, pageSize: 10 })).total,
    ).toBe(1);
    expect((await repos.news.list({ q: 'nothing like this', page: 1, pageSize: 10 })).total).toBe(
      0,
    );
  });
});

describe('global search', () => {
  it('searches every type and respects the per-type limit', async () => {
    const r = await repos.search.search(
      'sample',
      ['models', 'benchmarks', 'news', 'releases', 'providers', 'research'],
      3,
    );
    expect(r.q).toBe('sample');
    expect(r.results.models).toHaveLength(3);
    expect(r.results.models[0]).toMatchObject({
      type: 'models',
      href: expect.stringMatching(/^\/models\/sample-model-/),
      isDemo: true,
    });
    expect(r.results.benchmarks.length).toBeGreaterThan(0);
    expect(r.results.news.length).toBeGreaterThan(0);
    expect(r.results.research).toEqual([
      expect.objectContaining({
        type: 'research',
        title: 'A demo research paper about sample efficiency',
        href: 'https://example.invalid/demo/paper',
      }),
    ]);
  });

  it('only searches the requested types', async () => {
    const r = await repos.search.search('sample', ['benchmarks'], 5);
    expect(r.results.benchmarks.length).toBeGreaterThan(0);
    expect(r.results.models).toEqual([]);
    expect(r.results.news).toEqual([]);
  });

  it('matches providers by name and never treats input as a pattern', async () => {
    expect(
      (await repos.search.search('provider g', ['providers'], 5)).results.providers.map(
        (h) => h.id,
      ),
    ).toEqual(['demo-provider-g']);
    expect((await repos.search.search('%', ['providers', 'models', 'news'], 5)).results).toEqual({
      models: [],
      providers: [],
      benchmarks: [],
      releases: [],
      news: [],
      research: [],
    });
    expect(Object.values((await repos.search.search('   ', ['models'], 5)).results).flat()).toEqual(
      [],
    );
  });
});
