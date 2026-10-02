import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaModelRepository } from '../../server/repositories/prisma/model-repository';
import { defaultQuery } from '../../src/lib/models/query';
import type { ModelQuery } from '../../src/types/model';
import { createInMemoryModelRepository } from '../support/in-memory-model-repository';
import { newDb, seedDemo } from './helpers';

/**
 * PARITY: the PostgreSQL repository must return exactly what the in-memory reference returns
 * for the same fixtures, for every kind of query. This is what lets the UI switch from demo
 * data to the database without behaving differently.
 */
const db = newDb();
const sql = createPrismaModelRepository(db);
const memory = createInMemoryModelRepository();

const q = (over: Partial<ModelQuery> = {}): ModelQuery => ({
  ...defaultQuery,
  pageSize: 5,
  ...over,
});

beforeAll(async () => {
  await seedDemo(db);
});
afterAll(() => db.$disconnect());

const cases: [string, ModelQuery][] = [
  ['default', q()],
  ['page 2', q({ page: 2 })],
  ['page 4 (last)', q({ page: 4 })],
  ['page past the end (clamped)', q({ page: 99 })],
  ['small pages', q({ pageSize: 3, page: 2 })],
  ['one big page', q({ pageSize: 48 })],
  ...(['recent', 'updated', 'alpha', 'provider', 'context'] as const).flatMap((sort) =>
    [1, 2, 3].map((page): [string, ModelQuery] => [`sort ${sort} page ${page}`, q({ sort, page })]),
  ),
  ...[
    'sample-benchmark-1',
    'sample-benchmark-2',
    'sample-benchmark-3',
    'sample-benchmark-4',
    'sample-benchmark-5',
    'unknown-benchmark',
  ].map((benchmark): [string, ModelQuery] => [
    `benchmark sort ${benchmark}`,
    q({ sort: 'benchmark', benchmark, pageSize: 20 }),
  ]),
  [
    'benchmark sort page 2',
    q({ sort: 'benchmark', benchmark: 'sample-benchmark-1', page: 2, pageSize: 4 }),
  ],
  // search
  ...[
    'sample',
    'Sample Model 1',
    'model 12',
    'video',
    'audio generation',
    'embedding',
    'coding llm',
    'demo provider g',
    'zzzz',
    'g',
    '1',
    ' Sample   MODEL 1 ',
    'text generation',
    'placeholder record',
  ].map((text): [string, ModelQuery] => [`search "${text}"`, q({ q: text, pageSize: 20 })]),
  // characters that are special in SQL LIKE or in quoting
  ...['%', '_', "'", '"', '\\', ';--', 'ü'].map((text): [string, ModelQuery] => [
    `search special ${JSON.stringify(text)}`,
    q({ q: text }),
  ]),
  // filters
  ['provider a', q({ provider: ['demo-provider-a'] })],
  ['provider other', q({ provider: ['other'] })],
  ['provider other + c', q({ provider: ['other', 'demo-provider-c'] })],
  ['unknown provider', q({ provider: ['nobody'] })],
  ['category coding', q({ category: ['coding'] })],
  ['category embedding + video', q({ category: ['embedding', 'video-generation'] })],
  ['capability reasoning + audio-generation', q({ capability: ['reasoning', 'audio-generation'] })],
  ['deployment local', q({ deployment: ['local'] })],
  ['deployment open-weights + proprietary', q({ deployment: ['open-weights', 'proprietary'] })],
  ['pricing free-tier', q({ pricing: ['free-tier'] })],
  ['pricing unknown + custom', q({ pricing: ['unknown', 'custom'] })],
  // combinations
  ['coding + local + alpha', q({ category: ['coding'], deployment: ['local'], sort: 'alpha' })],
  [
    'search + provider + pricing + context',
    q({ q: 'model', provider: ['demo-provider-b'], pricing: ['paid'], sort: 'context' }),
  ],
  [
    'capability + benchmark sort + page 2',
    q({
      capability: ['tool-calling'],
      sort: 'benchmark',
      benchmark: 'sample-benchmark-2',
      page: 2,
      pageSize: 3,
    }),
  ],
  [
    'search + benchmark sort',
    q({ q: 'sample', sort: 'benchmark', benchmark: 'sample-benchmark-1', pageSize: 20 }),
  ],
  ['everything empty', q({ category: ['embedding'], pricing: ['free'] })],
];

describe('list(): SQL == in-memory', () => {
  it.each(cases)('%s', async (_name, query) => {
    const [a, b] = await Promise.all([sql.list(query), memory.list(query)]);
    expect(a.items.map((m) => m.slug)).toEqual(b.items.map((m) => m.slug)); // order first: clearest failure
    expect(a).toEqual(b);
  });

  it('covers a meaningful spread (guards against a vacuous parity test)', async () => {
    const sizes = await Promise.all(cases.map(([, query]) => sql.list(query).then((r) => r.total)));
    expect(sizes.some((n) => n === 0)).toBe(true);
    expect(sizes.some((n) => n === 16)).toBe(true);
    expect(sizes.some((n) => n > 0 && n < 16)).toBe(true);
    expect(new Set(sizes).size).toBeGreaterThan(8);
  });
});

describe('detail and related lookups: SQL == in-memory', () => {
  it('returns identical profiles for every model (specs, prices, results, history, capabilities)', async () => {
    const slugs = await memory.slugs();
    expect(slugs).toHaveLength(16);
    for (const slug of slugs) {
      expect(await sql.getBySlug(slug), slug).toEqual(await memory.getBySlug(slug));
    }
  });

  it('returns null for unknown slugs', async () => {
    expect(await sql.getBySlug('nope')).toBeNull();
    expect(await sql.getManyBySlugs(['nope'])).toEqual([]);
  });

  it('getManyBySlugs keeps the requested order and skips unknown slugs', async () => {
    const asked = ['sample-model-9', 'nope', 'sample-model-1', 'sample-model-14'];
    const [a, b] = await Promise.all([sql.getManyBySlugs(asked), memory.getManyBySlugs(asked)]);
    expect(a.map((m) => m.slug)).toEqual(['sample-model-9', 'sample-model-1', 'sample-model-14']);
    expect(a).toEqual(b);
  });

  it('related models match for every model', async () => {
    for (const slug of await memory.slugs()) {
      for (const limit of [3, 6]) {
        expect(
          (await sql.related(slug, limit)).map((m) => m.slug),
          `${slug}/${limit}`,
        ).toEqual((await memory.related(slug, limit)).map((m) => m.slug));
      }
    }
    expect(await sql.related('nope')).toEqual([]);
  });

  it('suggestions match, in the same order', async () => {
    for (const text of [
      'sample',
      'sample model 1',
      'video',
      'audio',
      'coding',
      'demo provider c',
      'zzz',
      '%',
      ' ',
      'model 1',
    ]) {
      expect(await sql.suggest(text, 6), text).toEqual(await memory.suggest(text, 6));
    }
    expect(await sql.suggest('sample', 2)).toHaveLength(2);
  });

  it('featured, benchmarks and slugs match', async () => {
    for (const n of [1, 6, 20]) expect(await sql.featured(n)).toEqual(await memory.featured(n));
    expect(await sql.benchmarks()).toEqual(await memory.benchmarks());
    expect(await sql.slugs()).toEqual(await memory.slugs());
  });

  it('stats match (fixed clock) and report demo data', async () => {
    const now = new Date('2026-09-29T00:00:00Z');
    const [a, b] = await Promise.all([sql.stats(now), memory.stats(now)]);
    expect({ ...a, lastDataUpdate: null, isDemo: true }).toEqual({
      ...b,
      lastDataUpdate: null,
      isDemo: true,
    });
    expect(a.isDemo).toBe(true);
    expect(a.total).toBe(16);
    expect(a.lastDataUpdate).toMatch(/^2026-09-25T00:00:00/); // newest fixture update (Sample Model 15)
  });

  it('keeps facet counts consistent with the filtered result sets', async () => {
    const all = await sql.list(q({ pageSize: 48 }));
    const coding = all.facets.category.find((f) => f.value === 'coding')!;
    const filtered = await sql.list(q({ category: ['coding'], pageSize: 48 }));
    expect(filtered.total).toBe(coding.count);
    // Removing the group's own filter for counts: alternatives stay visible while filtering.
    const embedding = filtered.facets.category.find((f) => f.value === 'embedding')!;
    expect(embedding.count).toBe(1);
  });
});
