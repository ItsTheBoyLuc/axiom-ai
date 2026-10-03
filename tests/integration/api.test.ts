import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { endpoints } from '../../server/api/endpoints';
import { createHandler, type Runtime } from '../../server/api/runtime';
import { createRepositories } from '../../server/repositories';
import { newDb, seedDemo } from './helpers';

const db = newDb();
const repos = createRepositories(db);
const runtime: Runtime = { repos, cache: null };

type Id = keyof typeof endpoints;

/** Calls an endpoint exactly like Next.js would: a Request plus an async params object. */
function call(
  id: Id,
  url: string,
  opts: { headers?: Record<string, string>; params?: Record<string, string>; rt?: Runtime } = {},
) {
  const handler = createHandler(endpoints[id], () => opts.rt ?? runtime);
  return handler(new Request(`http://test.local/api/v1${url}`, { headers: opts.headers }), {
    params: Promise.resolve(opts.params ?? {}),
  });
}

const slug = (s: string) => ({ slug: s });

beforeAll(async () => {
  await seedDemo(db);
});
afterAll(() => db.$disconnect());

const samples: [Id, string, Record<string, string>?][] = [
  ['stats', '/stats'],
  ['models', '/models?pageSize=5'],
  ['modelsSuggest', '/models/suggest?q=sample'],
  ['model', '/models/sample-model-2', slug('sample-model-2')],
  ['modelBenchmarks', '/models/sample-model-2/benchmarks', slug('sample-model-2')],
  ['modelPricing', '/models/sample-model-2/pricing', slug('sample-model-2')],
  ['modelReleases', '/models/sample-model-2/releases', slug('sample-model-2')],
  ['modelRelated', '/models/sample-model-2/related', slug('sample-model-2')],
  ['providers', '/providers'],
  ['provider', '/providers/demo-provider-a', slug('demo-provider-a')],
  ['benchmarks', '/benchmarks'],
  ['benchmarkResults', '/benchmarks/results?pageSize=5'],
  ['releases', '/releases'],
  ['news', '/news'],
  ['research', '/research'],
  ['search', '/search?q=sample'],
  ['compare', '/compare?models=sample-model-1,sample-model-2'],
  ['compareCsv', '/compare/export.csv?models=sample-model-1,sample-model-2'],
];

describe('every read endpoint', () => {
  it('is covered by this suite (health is served by its own route)', () => {
    const covered = new Set(samples.map(([id]) => id));
    const withHandler = Object.entries(endpoints)
      .filter(([, e]) => 'handler' in e)
      .map(([id]) => id);
    expect(withHandler.sort()).toEqual([...covered].sort());
  });

  it.each(samples)(
    '%s returns 200 that matches its declared response schema',
    async (id, url, params) => {
      const res = await call(id, url, { params });
      expect(res.status).toBe(200);
      const e = endpoints[id];
      expect(res.headers.get('etag')).toMatch(/^"[\w-]+"$/);
      expect(res.headers.get('x-cache')).toBe('BYPASS'); // no Redis in this runtime
      const policy = e.policy;
      expect(res.headers.get('cache-control')).toBe(
        policy === 'no-store'
          ? 'no-store'
          : `public, s-maxage=${policy.maxAge}, stale-while-revalidate=${policy.swr}`,
      );
      if (id === 'compareCsv') {
        expect(res.headers.get('content-type')).toMatch(/^text\/csv/);
        expect(res.headers.get('content-disposition')).toMatch(
          /^attachment; filename="axiom-compare-.*\.csv"$/,
        );
        return;
      }
      expect(res.headers.get('content-type')).toMatch(/^application\/json/);
      const parsed = e.response.safeParse(await res.json());
      expect(
        parsed.success,
        parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3)),
      ).toBe(true);
    },
  );
});

describe('GET /models', () => {
  it('paginates with honest totals and returns facets', async () => {
    const body = await (await call('models', '/models?pageSize=5')).json();
    expect(body.data).toHaveLength(5);
    expect(body.meta).toMatchObject({
      page: 1,
      pageSize: 5,
      total: 16,
      pageCount: 4,
      hasDemo: true,
    });
    expect(body.meta.facets.category).toHaveLength(8);
    expect(body.data[0]).toMatchObject({ isDemo: true, verificationStatus: 'UNVERIFIED' });
  });

  it('filters and sorts like the UI (single-benchmark sort, no overall ranking)', async () => {
    const coding = await (await call('models', '/models?category=coding&sort=alpha')).json();
    expect(coding.data.map((m: { slug: string }) => m.slug)).toEqual([
      'sample-model-1',
      'sample-model-11',
      'sample-model-15',
      'sample-model-3',
    ]);
    const bench = await (
      await call('models', '/models?sort=benchmark&benchmark=sample-benchmark-1&pageSize=3')
    ).json();
    expect(bench.data[0].slug).toBe('sample-model-11');
    const q = await (await call('models', '/models?q=video&provider=demo-provider-b')).json();
    expect(q.data.map((m: { slug: string }) => m.slug)).toContain('sample-model-9');
  });

  it('clamps a page past the end instead of returning nothing', async () => {
    const body = await (await call('models', '/models?page=99&pageSize=5')).json();
    expect(body.meta.page).toBe(4);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('returns an empty page (not an error) when nothing matches', async () => {
    const res = await call('models', '/models?q=nothing-matches-this');
    expect(res.status).toBe(200);
    expect((await res.json()).meta).toMatchObject({ total: 0, pageCount: 1, page: 1 });
  });
});

describe('detail endpoints', () => {
  it('returns the model profile and its sub-resources consistently', async () => {
    const detail = (
      await (
        await call('model', '/models/sample-model-2', { params: slug('sample-model-2') })
      ).json()
    ).data;
    const results = (
      await (await call('modelBenchmarks', '', { params: slug('sample-model-2') })).json()
    ).data;
    const pricing = (
      await (await call('modelPricing', '', { params: slug('sample-model-2') })).json()
    ).data;
    const history = (
      await (await call('modelReleases', '', { params: slug('sample-model-2') })).json()
    ).data;
    expect(results).toEqual(detail.benchmarks);
    expect(pricing).toEqual(detail.pricing);
    expect(history).toEqual(detail.releaseHistory);
    // both results for benchmark 1 stay separate; nothing is averaged
    expect(
      results.filter((r: { benchmarkSlug: string }) => r.benchmarkSlug === 'sample-benchmark-1'),
    ).toHaveLength(2);
    // historical prices are present and marked
    expect(pricing.some((p: { isCurrent: boolean }) => !p.isCurrent)).toBe(true);
  });

  it('represents undisclosed values as null, never as zero or empty', async () => {
    const detail = (await (await call('model', '', { params: slug('sample-model-14') })).json())
      .data;
    expect(detail.contextWindow).toBeNull();
    expect(detail.specs.maxOutputTokens).toBeNull();
    expect(detail.currentPricing).toBeNull();
    expect(detail.pricing).toEqual([]);
    expect(detail.benchmarks).toEqual([]);
    const out = (await (await call('model', '', { params: slug('sample-model-5') })).json()).data;
    expect(out.currentPricing).toMatchObject({ input: 0.5, output: null });
  });

  it('returns related models, provider profiles and benchmark results', async () => {
    const related = (
      await (await call('modelRelated', '?limit=2', { params: slug('sample-model-1') })).json()
    ).data;
    expect(related).toHaveLength(2);
    expect(related.every((m: { slug: string }) => m.slug !== 'sample-model-1')).toBe(true);
    const provider = (
      await (await call('provider', '', { params: slug('demo-provider-g') })).json()
    ).data;
    expect(provider).toMatchObject({ tier: 'other', modelCount: 2 });
    const rows = (
      await (
        await call(
          'benchmarkResults',
          '/benchmarks/results?benchmark=sample-benchmark-1&pageSize=50',
        )
      ).json()
    ).data;
    expect(
      rows.every((r: { benchmarkSlug: string }) => r.benchmarkSlug === 'sample-benchmark-1'),
    ).toBe(true);
  });
});

describe('search, releases, news', () => {
  it('searches across types and filters by type', async () => {
    const all = (await (await call('search', '/search?q=sample&limit=2')).json()).data;
    expect(all.results.models).toHaveLength(2);
    const only = (await (await call('search', '/search?q=sample&types=news')).json()).data;
    expect(only.results.models).toEqual([]);
    expect(only.results.news.length).toBeGreaterThan(0);
  });

  it('filters releases by kind (kebab-case) and news by category', async () => {
    const dep = await (await call('releases', '/releases?category=deprecation')).json();
    expect(dep.meta.total).toBe(2);
    const research = await (await call('news', '/news?category=research')).json();
    expect(research.data.map((n: { title: string }) => n.title)).toEqual([
      'Sample headline: research note',
    ]);
    const official = (await (await call('news', '/news')).json()).data;
    expect(official[0]).toMatchObject({ isOfficial: true, isAiSummary: false });
  });
});

describe('compare', () => {
  it('returns profiles in the requested order and caps at four models', async () => {
    const body = await (
      await call('compare', '/compare?models=sample-model-9,sample-model-1')
    ).json();
    expect(body.data.map((m: { slug: string }) => m.slug)).toEqual([
      'sample-model-9',
      'sample-model-1',
    ]);
    const five = await call('compare', '/compare?models=a,b,c,d,e');
    expect(five.status).toBe(400);
    expect((await five.json()).error.details[0].message).toMatch(/at most 4/);
  });

  it('lists every unknown model in a 404', async () => {
    const res = await call('compare', '/compare?models=sample-model-1,ghost-a,ghost-b');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.details).toEqual({ missing: ['ghost-a', 'ghost-b'] });
  });

  it('exports CSV with one column per model, separate benchmark rows and honest gaps', async () => {
    const res = await call(
      'compareCsv',
      '/compare/export.csv?models=sample-model-2,sample-model-14',
    );
    const text = await res.text();
    const rows = text.trim().split('\r\n');
    expect(rows[0]).toBe('Attribute,Sample Model 2,Sample Model 14');
    expect(text).toContain('Context window (tokens),200000,Not publicly disclosed');
    expect(text).toContain('Benchmark: Sample Benchmark 1,');
    expect(text).toMatch(/No verified data/);
    expect(text).not.toMatch(/average|overall|combined/i);
    expect(res.headers.get('content-disposition')).toContain(
      'axiom-compare-sample-model-2-sample-model-14.csv',
    );
  });
});

describe('validation and errors use the spec envelope', () => {
  const bad: [Id, string, string, Record<string, string>?][] = [
    ['models', '/models?category=telepathy', 'category'],
    ['models', '/models?sort=best', 'sort'],
    ['models', '/models?page=0', 'page'],
    ['models', '/models?pageSize=101', 'pageSize'],
    ['models', '/models?sort=benchmark', 'benchmark'],
    ['models', '/models?categroy=coding', ''],
    ['modelsSuggest', '/models/suggest', 'q'],
    ['releases', '/releases?from=2026-02-01&to=2026-01-01', 'to'],
    ['news', '/news?official=maybe', 'official'],
    ['research', '/research?pageSize=0', 'pageSize'],
    ['search', '/search?q=x&types=bogus', 'types'],
    ['stats', '/stats?unexpected=1', ''],
  ];

  it.each(bad)('%s %s -> 400 INVALID_QUERY', async (id, url, field) => {
    const res = await call(id, url);
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toMatch(/json/);
    const { error } = await res.json();
    expect(error.code).toBe('INVALID_QUERY');
    expect(error.message).toBeTruthy();
    expect(Array.isArray(error.details)).toBe(true);
    if (field) {
      // list items are reported precisely, e.g. "category.0"
      expect(
        error.details.some(
          (d: { path: string }) => d.path === field || d.path.startsWith(`${field}.`),
        ),
      ).toBe(true);
    }
  });

  it('rejects a malformed slug path parameter', async () => {
    const res = await call('model', '/models/Bad_Slug', { params: slug('Bad_Slug') });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_PARAMS');
  });

  it.each<[Id, string, string]>([
    ['model', 'nope', 'Model "nope" not found'],
    ['modelBenchmarks', 'nope', 'Model'],
    ['modelPricing', 'nope', 'Model'],
    ['modelReleases', 'nope', 'Model'],
    ['modelRelated', 'nope', 'Model'],
    ['provider', 'nobody', 'Provider "nobody" not found'],
  ])('%s for an unknown slug -> 404 NOT_FOUND', async (id, s, message) => {
    const res = await call(id, '', { params: slug(s) });
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const { error } = await res.json();
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain(message);
  });

  it('turns unexpected failures into a safe 500 (no message, stack or secrets leaked)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: Runtime = {
      cache: null,
      repos: {
        ...repos,
        models: {
          ...repos.models,
          list: async () => {
            throw new Error('connect ECONNREFUSED postgres://axiom:hunter2@db/axiom');
          },
        },
      },
    };
    const res = await call('models', '/models', { rt: broken });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(text).not.toMatch(/hunter2|ECONNREFUSED|postgres:/);
    expect(spy).toHaveBeenCalled(); // but it IS logged server-side
    spy.mockRestore();
  });
});

describe('ETag and conditional requests', () => {
  it('returns 304 with no body when If-None-Match matches, and 200 when it does not', async () => {
    const first = await call('models', '/models?pageSize=3');
    const etag = first.headers.get('etag')!;
    expect(first.status).toBe(200);

    const notModified = await call('models', '/models?pageSize=3', {
      headers: { 'If-None-Match': etag },
    });
    expect(notModified.status).toBe(304);
    expect(await notModified.text()).toBe('');
    expect(notModified.headers.get('etag')).toBe(etag);
    expect(notModified.headers.get('cache-control')).toContain('s-maxage=60');

    expect(
      (await call('models', '/models?pageSize=3', { headers: { 'If-None-Match': '"stale"' } }))
        .status,
    ).toBe(200);
    expect(
      (await call('models', '/models?pageSize=3', { headers: { 'If-None-Match': `W/${etag}` } }))
        .status,
    ).toBe(304);
    expect(
      (await call('models', '/models?pageSize=4', { headers: { 'If-None-Match': etag } })).status,
    ).toBe(200); // different content
  });

  it('gives identical ETags for identical data', async () => {
    const a = (await call('stats', '/stats')).headers.get('etag');
    const b = (await call('stats', '/stats')).headers.get('etag');
    expect(a).toBe(b);
  });
});

describe('OpenAPI and docs routes', () => {
  it('serves the generated OpenAPI document at /api/docs/openapi.json', async () => {
    const { GET } = await import('../../src/app/api/docs/openapi.json/route');
    const res = GET();
    expect(res.status).toBe(200);
    const doc = await res.json();
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths).sort()).toEqual(
      Object.values(endpoints)
        .map((e) => e.path)
        .sort(),
    );
  });

  it('serves an HTML reference at /api/docs', async () => {
    const { GET } = await import('../../src/app/api/docs/route');
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('/api/v1/compare/export.csv');
    expect(html).not.toMatch(/<script/i);
  });
});

describe('route modules', () => {
  const all = import.meta.glob<{ GET: unknown; dynamic?: string }>(
    '../../src/app/api/v1/**/route.ts',
  );
  // Session-bound routes are not part of the public, documented read API (see admin-rbac tests).
  const modules = Object.fromEntries(
    Object.entries(all).filter(([file]) => !/\/api\/v1\/(auth|admin)\//.test(file)),
  );

  it('all export a GET handler and render on request (never prerendered at build)', async () => {
    const entries = Object.entries(modules);
    expect(entries.length).toBe(Object.keys(endpoints).length);
    for (const [file, load] of entries) {
      const mod = await load();
      expect(typeof mod.GET, file).toBe('function');
      expect(mod.dynamic, file).toBe('force-dynamic');
    }
  });
});

describe('GET /api/v1/health', () => {
  it('reports postgres and redis', async () => {
    const { GET } = await import('../../src/app/api/v1/health/route');
    const res = await GET();
    const body = await res.json();
    expect(body.checks.postgres.ok).toBe(true);
    expect([200, 503]).toContain(res.status);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(endpoints.health.response.safeParse(body).success).toBe(true);
  });
});
