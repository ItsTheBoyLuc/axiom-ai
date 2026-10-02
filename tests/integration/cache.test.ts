import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCache, type Cache } from '../../server/cache/cache';
import { endpoints } from '../../server/api/endpoints';
import { createHandler, type Runtime } from '../../server/api/runtime';
import { createRepositories } from '../../server/repositories';
import { newDb, seedDemo } from './helpers';

/** Real Redis (docker compose locally, service container in CI). */
const url = process.env.REDIS_URL!;
const prefix = `axiom:test:${Date.now().toString(36)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let cache: Cache;
const counter = () => {
  let n = 0;
  return { load: async () => ({ n: ++n }), calls: () => n };
};

beforeAll(async () => {
  cache = createCache({ url, prefix, log: () => {} });
  if (!(await cache.ready(4_000)))
    throw new Error(`Redis is not reachable at ${url}: start it with "docker compose up -d redis"`);
});
afterAll(async () => {
  await cache.flush();
  await cache.close();
});

describe('read-through cache', () => {
  it('runs the loader once, then serves hits', async () => {
    const c = counter();
    const a = await cache.wrap('basic', { ttlSeconds: 30, tags: ['t'] }, c.load);
    const b = await cache.wrap('basic', { ttlSeconds: 30, tags: ['t'] }, c.load);
    expect(a.status).toBe('MISS');
    expect(b.status).toBe('HIT');
    expect(b.value).toEqual({ n: 1 });
    expect(c.calls()).toBe(1);
  });

  it('round-trips JSON values faithfully (null, nested, arrays, strings)', async () => {
    const value = { a: null, b: [1, 2, { c: 'x' }], d: 'text,with "quotes"\r\n', e: 0, f: false };
    await cache.wrap('json', { ttlSeconds: 30, tags: [] }, async () => value);
    expect(
      (await cache.wrap('json', { ttlSeconds: 30, tags: [] }, async () => ({}))).value,
    ).toEqual(value);
    await cache.wrap('csv', { ttlSeconds: 30, tags: [] }, async () => 'a,b\r\n1,2\r\n');
    expect((await cache.wrap('csv', { ttlSeconds: 30, tags: [] }, async () => 'x')).value).toBe(
      'a,b\r\n1,2\r\n',
    );
  });

  it('keeps keys independent', async () => {
    const a = counter();
    const b = counter();
    await cache.wrap('k1', { ttlSeconds: 30, tags: [] }, a.load);
    await cache.wrap('k2', { ttlSeconds: 30, tags: [] }, b.load);
    await cache.wrap('k1', { ttlSeconds: 30, tags: [] }, a.load);
    expect([a.calls(), b.calls()]).toEqual([1, 1]);
  });

  it('expires entries after their TTL', async () => {
    const c = counter();
    await cache.wrap('ttl', { ttlSeconds: 1, tags: [] }, c.load);
    expect((await cache.wrap('ttl', { ttlSeconds: 1, tags: [] }, c.load)).status).toBe('HIT');
    await sleep(1_300);
    expect((await cache.wrap('ttl', { ttlSeconds: 1, tags: [] }, c.load)).status).toBe('MISS');
    expect(c.calls()).toBe(2);
  });

  it('does not cache failures: the loader error propagates and the next call retries', async () => {
    let attempts = 0;
    const load = async () => {
      if (++attempts === 1) throw new Error('boom');
      return { ok: true };
    };
    await expect(cache.wrap('fails', { ttlSeconds: 30, tags: [] }, load)).rejects.toThrow('boom');
    const r = await cache.wrap('fails', { ttlSeconds: 30, tags: [] }, load);
    expect(r).toEqual({ value: { ok: true }, status: 'MISS' });
  });
});

describe('tag invalidation', () => {
  it('makes only the entries carrying the tag stale', async () => {
    const a = counter();
    const b = counter();
    await cache.wrap('tag-a', { ttlSeconds: 30, tags: ['models'] }, a.load);
    await cache.wrap('tag-b', { ttlSeconds: 30, tags: ['news'] }, b.load);
    await cache.invalidateTags(['models']);
    expect((await cache.wrap('tag-a', { ttlSeconds: 30, tags: ['models'] }, a.load)).status).toBe(
      'MISS',
    );
    expect((await cache.wrap('tag-b', { ttlSeconds: 30, tags: ['news'] }, b.load)).status).toBe(
      'HIT',
    );
    expect(a.calls()).toBe(2);
  });

  it('invalidates entries with several tags when any one of them changes', async () => {
    const c = counter();
    const tags = ['models', 'model:x', 'providers'];
    await cache.wrap('multi', { ttlSeconds: 30, tags }, c.load);
    await cache.invalidateTags(['model:x']);
    expect((await cache.wrap('multi', { ttlSeconds: 30, tags }, c.load)).status).toBe('MISS');
  });

  it('invalidateAll makes every entry stale', async () => {
    const a = counter();
    const b = counter();
    await cache.wrap('all-a', { ttlSeconds: 30, tags: ['x'] }, a.load);
    await cache.wrap('all-b', { ttlSeconds: 30, tags: [] }, b.load);
    await cache.invalidateAll();
    expect((await cache.wrap('all-a', { ttlSeconds: 30, tags: ['x'] }, a.load)).status).toBe(
      'MISS',
    );
    expect((await cache.wrap('all-b', { ttlSeconds: 30, tags: [] }, b.load)).status).toBe('MISS');
  });

  it('is safe under concurrent invalidations (one reload afterwards, never a stale hit)', async () => {
    const c = counter();
    await cache.wrap('conc', { ttlSeconds: 30, tags: ['c'] }, c.load);
    await Promise.all(Array.from({ length: 40 }, () => cache.invalidateTags(['c'])));
    expect((await cache.wrap('conc', { ttlSeconds: 30, tags: ['c'] }, c.load)).status).toBe('MISS');
    expect((await cache.wrap('conc', { ttlSeconds: 30, tags: ['c'] }, c.load)).status).toBe('HIT');
  });

  it('an empty tag list is a no-op', async () => {
    await expect(cache.invalidateTags([])).resolves.toBeUndefined();
  });
});

describe('when Redis is unavailable the cache degrades, it never fails requests', () => {
  it('serves from the loader (BYPASS) and does not throw or hang', async () => {
    const warnings: string[] = [];
    const down = createCache({
      url: 'redis://127.0.0.1:1',
      prefix,
      log: (m) => warnings.push(m),
      commandTimeoutMs: 200,
    });
    try {
      const started = Date.now();
      const r = await down.wrap('x', { ttlSeconds: 30, tags: ['t'] }, async () => ({
        fresh: true,
      }));
      expect(r).toEqual({ value: { fresh: true }, status: 'BYPASS' });
      await expect(down.invalidateTags(['t'])).resolves.toBeUndefined();
      await expect(down.invalidateAll()).resolves.toBeUndefined();
      expect(Date.now() - started).toBeLessThan(3_000);
      expect(await down.ready(300)).toBe(false);
      expect(warnings.length).toBeGreaterThan(0); // reported, rate limited
    } finally {
      await down.close();
    }
  });
});

describe('API responses through the cache', () => {
  const db = newDb();
  const repos = createRepositories(db);
  let runtime: Runtime;
  const get = (id: keyof typeof endpoints, u: string, params?: Record<string, string>) =>
    createHandler(endpoints[id], () => runtime)(new Request(`http://test.local/api/v1${u}`), {
      params: Promise.resolve(params ?? {}),
    });
  const nameOf = async (res: Response) => (await res.json()).data.name as string;

  beforeAll(async () => {
    await seedDemo(db);
    runtime = { repos, cache };
    await cache.invalidateAll();
  });
  afterAll(() => db.$disconnect());

  it('MISS then HIT with identical bodies and ETags', async () => {
    const a = await get('model', '/models/sample-model-3', { slug: 'sample-model-3' });
    const b = await get('model', '/models/sample-model-3', { slug: 'sample-model-3' });
    expect(a.headers.get('x-cache')).toBe('MISS');
    expect(b.headers.get('x-cache')).toBe('HIT');
    expect(b.headers.get('etag')).toBe(a.headers.get('etag'));
    expect(await b.json()).toEqual(await a.json());
  });

  it('keys on the parsed query, so equivalent URLs share one entry', async () => {
    await get('models', '/models?pageSize=7');
    const same = await get('models', '/models?pageSize=7&page=1&sort=recent');
    expect(same.headers.get('x-cache')).toBe('HIT');
    const different = await get('models', '/models?pageSize=8');
    expect(different.headers.get('x-cache')).toBe('MISS');
  });

  it('serves the cached copy after a database write, until the tag is invalidated', async () => {
    const p = { slug: 'sample-model-1' };
    expect(await nameOf(await get('model', '/models/sample-model-1', p))).toBe('Sample Model 1');

    await db.model.update({ where: { slug: 'sample-model-1' }, data: { name: 'Renamed Model' } });
    const stale = await get('model', '/models/sample-model-1', p);
    expect(stale.headers.get('x-cache')).toBe('HIT');
    expect(await nameOf(stale)).toBe('Sample Model 1'); // still the cached copy

    await cache.invalidateTags(['model:sample-model-1']); // what a write path does
    const fresh = await get('model', '/models/sample-model-1', p);
    expect(fresh.headers.get('x-cache')).toBe('MISS');
    expect(await nameOf(fresh)).toBe('Renamed Model');
    expect((await get('model', '/models/sample-model-1', p)).headers.get('x-cache')).toBe('HIT');
  });

  it('per-model tags leave other models cached, and broad tags refresh lists', async () => {
    const other = { slug: 'sample-model-2' };
    await get('model', '/models/sample-model-2', other);
    await get('providers', '/providers');
    await db.model.update({ where: { slug: 'sample-model-2' }, data: { name: 'Second Rename' } });

    await cache.invalidateTags(['model:sample-model-1']);
    expect((await get('model', '/models/sample-model-2', other)).headers.get('x-cache')).toBe(
      'HIT',
    );
    expect((await get('providers', '/providers')).headers.get('x-cache')).toBe('HIT');

    await cache.invalidateTags(['models']); // broad tag: every model-derived response refreshes
    const refreshed = await get('model', '/models/sample-model-2', other);
    expect(refreshed.headers.get('x-cache')).toBe('MISS');
    expect(await nameOf(refreshed)).toBe('Second Rename');
    expect((await get('providers', '/providers')).headers.get('x-cache')).toBe('MISS');
  });

  it('never caches errors: a model created after a 404 is visible immediately', async () => {
    const p = { slug: 'brand-new' };
    const missing = await get('model', '/models/brand-new', p);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('x-cache')).toBeNull();

    const template = await db.model.findUniqueOrThrow({
      where: { slug: 'sample-model-3' },
      select: { providerId: true },
    });
    await db.model.create({
      data: {
        providerId: template.providerId,
        name: 'Brand New',
        slug: 'brand-new',
        sortName: 'brand new',
        family: 'F',
        description: 'd',
        categories: ['LLM'],
        releaseDate: new Date('2026-09-01'),
        openWeights: false,
        availability: 'CLOUD_API',
        isDemo: true,
        verificationStatus: 'UNVERIFIED',
      },
    });
    const found = await get('model', '/models/brand-new', p);
    expect(found.status).toBe(200);
    expect(await nameOf(found)).toBe('Brand New');
  });

  it('a Redis outage does not break API requests', async () => {
    const down = createCache({
      url: 'redis://127.0.0.1:1',
      prefix,
      log: () => {},
      commandTimeoutMs: 200,
    });
    try {
      const res = await createHandler(endpoints.stats, () => ({ repos, cache: down }))(
        new Request('http://test.local/api/v1/stats'),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('x-cache')).toBe('BYPASS');
      expect((await res.json()).data.totalModels).toBeGreaterThan(0);
    } finally {
      await down.close();
    }
  });

  it('works without any cache configured (REDIS_URL unset)', async () => {
    const res = await createHandler(endpoints.stats, () => ({ repos, cache: null }))(
      new Request('http://test.local/api/v1/stats'),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('x-cache')).toBe('BYPASS');
    void vi;
  });
});
