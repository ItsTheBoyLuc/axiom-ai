import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NEWS_CATEGORIES } from '../../src/types/catalog';
import { createRepositories } from '../../server/repositories';
import { newDb, seedDemo } from './helpers';

const db = newDb();
const repos = createRepositories(db);

beforeAll(async () => {
  await seedDemo(db);
  const find = (slug: string) =>
    db.provider.findUniqueOrThrow({ where: { slug }, select: { id: true } });
  const [a, b] = await Promise.all([find('demo-provider-a'), find('demo-provider-b')]);
  const base = { isDemo: true, dataType: 'demo', verificationStatus: 'UNVERIFIED' as const };
  await db.publication.createMany({
    data: [
      {
        providerId: a.id,
        title: 'Sample efficiency in demo models',
        url: 'https://example.invalid/p1',
        publishedAt: new Date('2026-05-01'),
        venue: 'Demo Venue',
        ...base,
      },
      {
        providerId: a.id,
        title: 'A second demo paper',
        url: 'https://example.invalid/p2',
        publishedAt: new Date('2026-07-01'),
        venue: null,
        ...base,
      },
      {
        providerId: b.id,
        title: 'Scaling notes',
        url: 'https://example.invalid/p3',
        publishedAt: new Date('2026-06-01'),
        venue: 'Another Venue',
        ...base,
      },
    ],
  });
});
afterAll(() => db.$disconnect());

describe('news filters and facets', () => {
  it('official=true keeps official sources only, official=false independent reporting only', async () => {
    const all = await repos.news.list({ page: 1, pageSize: 50 });
    const official = await repos.news.list({ official: true, page: 1, pageSize: 50 });
    const independent = await repos.news.list({ official: false, page: 1, pageSize: 50 });
    expect(official.items.every((n) => n.isOfficial)).toBe(true);
    expect(independent.items.every((n) => !n.isOfficial)).toBe(true);
    expect(official.total + independent.total).toBe(all.total);
    expect(official.total).toBeGreaterThan(0);
    expect(independent.total).toBeGreaterThan(0);
  });

  it('combines with category, provider and search', async () => {
    const all = await repos.news.list({ page: 1, pageSize: 50 });
    const some = all.items.find((n) => n.provider)!;
    const r = await repos.news.list({
      official: some.isOfficial,
      category: some.category,
      provider: some.provider!.slug,
      page: 1,
      pageSize: 50,
    });
    expect(r.items.map((n) => n.id)).toContain(some.id);
    const none = await repos.news.list({
      q: 'zzzz-no-such-story',
      official: true,
      page: 1,
      pageSize: 5,
    });
    expect(none.total).toBe(0);
  });

  it('facets count every story by source type and category, matching the list', async () => {
    const f = await repos.news.facets();
    const all = await repos.news.list({ page: 1, pageSize: 100 });
    expect(f.total).toBe(all.total);
    expect(f.official + f.independent).toBe(f.total);
    expect(Object.keys(f.byCategory).sort()).toEqual([...NEWS_CATEGORIES].sort());
    expect(Object.values(f.byCategory).reduce((n, c) => n + c, 0)).toBe(f.total);
    for (const c of NEWS_CATEGORIES) {
      const r = await repos.news.list({ category: c, page: 1, pageSize: 1 });
      expect(f.byCategory[c], c).toBe(r.total);
    }
    expect(f.official).toBe(
      (await repos.news.list({ official: true, page: 1, pageSize: 1 })).total,
    );
  });
});

describe('news date kind', () => {
  it('defaults to a publication date and round-trips an "updated" date through the API shape', async () => {
    const before = await repos.news.list({ page: 1, pageSize: 50 });
    expect(before.items.every((n) => n.dateIsUpdated === false)).toBe(true);
    const target = before.items[0]!;
    await db.newsArticle.update({
      where: { articleUrl: target.url },
      data: { dateIsUpdated: true },
    });
    const after = await repos.news.list({ page: 1, pageSize: 50 });
    expect(after.items.find((n) => n.id === target.id)!.dateIsUpdated).toBe(true);
    expect(after.items.filter((n) => n.dateIsUpdated)).toHaveLength(1);
    await db.newsArticle.update({
      where: { articleUrl: target.url },
      data: { dateIsUpdated: false },
    });
  });
});

describe('research publications', () => {
  it('lists newest first with the provider, paginated', async () => {
    const r = await repos.research.list({ page: 1, pageSize: 2 });
    expect(r.total).toBe(3);
    expect(r.pageCount).toBe(2);
    expect(r.items.map((x) => x.publishedAt)).toEqual(['2026-07-01', '2026-06-01']);
    expect(r.items[0]).toMatchObject({
      provider: { slug: 'demo-provider-a' },
      venue: null,
      isDemo: true,
    });
    const p2 = await repos.research.list({ page: 2, pageSize: 2 });
    expect(p2.items.map((x) => x.title)).toEqual(['Sample efficiency in demo models']);
  });

  it('filters by provider and by title or venue text', async () => {
    expect(
      (await repos.research.list({ provider: 'demo-provider-b', page: 1, pageSize: 10 })).total,
    ).toBe(1);
    expect((await repos.research.list({ q: 'venue', page: 1, pageSize: 10 })).total).toBe(2);
    expect(
      (await repos.research.list({ q: 'scaling', page: 1, pageSize: 10 })).items[0]!.title,
    ).toBe('Scaling notes');
    expect(
      (await repos.research.list({ q: 'nothing like this', page: 1, pageSize: 10 })).total,
    ).toBe(0);
  });

  it('is included in global search, linking to the paper itself', async () => {
    const r = await repos.search.search('scaling', ['research'], 5);
    expect(r.results.research[0]).toMatchObject({
      title: 'Scaling notes',
      href: 'https://example.invalid/p3',
    });
  });
});

describe('search hit links', () => {
  it("a release hit opens the provider profile at that release's anchor", async () => {
    const r = await repos.search.search('released', ['releases'], 3);
    const hit = r.results.releases[0];
    expect(hit).toBeTruthy();
    expect(hit!.href).toMatch(/^\/providers\/demo-provider-[a-g]#release-/);
    expect(hit!.href.endsWith(`#release-${hit!.id}`)).toBe(true);
  });

  it('model, provider and benchmark hits are internal paths; news hits are the article URL', async () => {
    const r = await repos.search.search('sample', ['models', 'providers', 'benchmarks', 'news'], 3);
    for (const h of [...r.results.models, ...r.results.providers, ...r.results.benchmarks]) {
      expect(h.href.startsWith('/')).toBe(true);
    }
    for (const h of r.results.news) expect(h.href).toMatch(/^https:\/\//);
  });
});
