import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderDocsHtml } from '../../server/api/docs-html';
import { endpoints } from '../../server/api/endpoints';
import { buildOpenApi } from '../../server/api/openapi';
import {
  benchmarkResultsQuerySchema,
  compareQuerySchema,
  modelsQuerySchema,
  newsQuerySchema,
  releasesQuerySchema,
  searchQuerySchema,
  slugParams,
  suggestQuerySchema,
} from '../../server/api/schemas';
import { SEARCH_TYPES } from '../../src/types/catalog';

const parse = <T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } },
  q: Record<string, string>,
) => schema.safeParse(q);

describe('GET /models query schema', () => {
  it('applies defaults', () => {
    const r = parse(modelsQuerySchema, {});
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      q: '',
      sort: 'recent',
      benchmark: null,
      page: 1,
      pageSize: 20,
      provider: [],
      category: [],
    });
  });

  it('parses comma separated filters and paging', () => {
    const r = parse(modelsQuerySchema, {
      q: ' llama ',
      provider: 'demo-provider-a,other',
      category: 'coding,image-generation',
      capability: 'reasoning',
      deployment: 'local',
      pricing: 'free,free-tier',
      sort: 'context',
      page: '3',
      pageSize: '50',
    });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      q: 'llama',
      provider: ['demo-provider-a', 'other'],
      category: ['coding', 'image-generation'],
      pricing: ['free', 'free-tier'],
      sort: 'context',
      page: 3,
      pageSize: 50,
    });
  });

  it.each<Record<string, string>>([
    { category: 'telepathy' },
    { pricing: 'cheap' },
    { sort: 'best' },
    { provider: 'Bad Slug!' },
    { page: '0' },
    { page: 'abc' },
    { page: '-1' },
    { pageSize: '0' },
    { pageSize: '101' },
    { q: 'x'.repeat(101) },
  ])('rejects %j', (q) => {
    expect(parse(modelsQuerySchema, q).success).toBe(false);
  });

  it('rejects unknown parameters', () => {
    expect(parse(modelsQuerySchema, { categroy: 'coding' }).success).toBe(false);
  });

  it('requires a benchmark when sorting by benchmark', () => {
    expect(parse(modelsQuerySchema, { sort: 'benchmark' }).success).toBe(false);
    const ok = parse(modelsQuerySchema, { sort: 'benchmark', benchmark: 'sample-benchmark-1' });
    expect(ok.success).toBe(true);
    expect(ok.data).toMatchObject({ sort: 'benchmark', benchmark: 'sample-benchmark-1' });
  });

  it('limits list length', () => {
    expect(
      parse(modelsQuerySchema, {
        provider: Array.from({ length: 21 }, (_, i) => `p${i}`).join(','),
      }).success,
    ).toBe(false);
  });
});

describe('other query schemas', () => {
  it('suggest needs a non-empty q', () => {
    expect(parse(suggestQuerySchema, {}).success).toBe(false);
    expect(parse(suggestQuerySchema, { q: '   ' }).success).toBe(false);
    expect(parse(suggestQuerySchema, { q: 'a' }).data).toEqual({ q: 'a', limit: 6 });
    expect(parse(suggestQuerySchema, { q: 'a', limit: '11' }).success).toBe(false);
  });

  it('compare accepts 1-4 distinct slugs and de-duplicates', () => {
    expect(parse(compareQuerySchema, { models: 'a,b,a' }).data).toEqual({ models: ['a', 'b'] });
    expect(parse(compareQuerySchema, { models: 'a,b,c,d,e' }).success).toBe(false);
    expect(parse(compareQuerySchema, {}).success).toBe(false);
    expect(parse(compareQuerySchema, { models: 'a,B_d' }).success).toBe(false);
  });

  it('search defaults to every type and validates a subset', () => {
    expect(parse(searchQuerySchema, { q: 'x' }).data).toMatchObject({
      types: [...SEARCH_TYPES],
      limit: 5,
    });
    expect(parse(searchQuerySchema, { q: 'x', types: 'models,news' }).data).toMatchObject({
      types: ['models', 'news'],
    });
    expect(parse(searchQuerySchema, { q: 'x', types: 'models,bogus' }).success).toBe(false);
  });

  it('releases and news map kebab-case categories to the database enums', () => {
    expect(parse(releasesQuerySchema, { category: 'api-change' }).data).toMatchObject({
      category: 'API_CHANGE',
    });
    expect(parse(releasesQuerySchema, { category: 'nonsense' }).success).toBe(false);
    expect(parse(newsQuerySchema, { category: 'model-releases' }).data).toMatchObject({
      category: 'MODEL_RELEASES',
    });
  });

  it('date ranges must be valid and ordered', () => {
    expect(parse(releasesQuerySchema, { from: '2026-01-01', to: '2026-02-01' }).success).toBe(true);
    expect(parse(releasesQuerySchema, { from: '2026-02-01', to: '2026-01-01' }).success).toBe(
      false,
    );
    expect(parse(releasesQuerySchema, { from: '01/02/2026' }).success).toBe(false);
    expect(parse(benchmarkResultsQuerySchema, { from: '2026-02-30' }).success).toBe(false);
  });

  it('path slugs are validated', () => {
    expect(slugParams.safeParse({ slug: 'sample-model-1' }).success).toBe(true);
    expect(slugParams.safeParse({ slug: '../etc/passwd' }).success).toBe(false);
    expect(slugParams.safeParse({ slug: 'A' }).success).toBe(false);
  });
});

describe('OpenAPI generated from the Zod schemas', () => {
  const doc = buildOpenApi();

  it('is an OpenAPI 3.1 document with the /api/v1 server', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers).toEqual([{ url: '/api/v1' }]);
    expect(doc.info.description).toMatch(/never guessed/);
  });

  it('documents every endpoint of the registry, with a 200 schema', () => {
    for (const e of Object.values(endpoints)) {
      const op = (
        doc.paths[e.path] as Record<
          string,
          { operationId: string; responses: Record<string, unknown> }
        >
      )?.get;
      expect(op, e.path).toBeDefined();
      expect(op!.operationId).toBe(e.id);
      expect(op!.responses['200']).toBeDefined();
    }
  });

  it('derives parameters (with enums and required flags) from the request schemas', () => {
    type P = {
      name: string;
      in: string;
      required: boolean;
      schema: { enum?: string[]; type?: string };
    };
    const params = (doc.paths['/models'] as { get: { parameters: P[] } }).get.parameters;
    const names = params.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'q',
        'provider',
        'category',
        'capability',
        'deployment',
        'pricing',
        'sort',
        'benchmark',
        'page',
        'pageSize',
      ]),
    );
    expect(params.find((p) => p.name === 'sort')!.schema.enum).toContain('benchmark');
    const path = (doc.paths['/models/{slug}'] as { get: { parameters: P[] } }).get.parameters;
    expect(path).toHaveLength(1);
    expect(path[0]).toMatchObject({ name: 'slug', in: 'path', required: true });
  });

  it('documents the error envelope and conditional requests', () => {
    const op = (
      doc.paths['/models/{slug}'] as { get: { responses: Record<string, { content?: unknown }> } }
    ).get;
    expect(Object.keys(op.responses)).toEqual(
      expect.arrayContaining(['200', '304', '400', '404', '500']),
    );
    expect(doc.components.schemas.ApiError).toBeDefined();
  });

  it('documents the CSV export as text/csv', () => {
    const op = (
      doc.paths['/compare/export.csv'] as {
        get: { responses: { '200': { content: Record<string, unknown> } } };
      }
    ).get;
    expect(Object.keys(op.responses['200'].content)).toEqual(['text/csv']);
  });

  it('renders an HTML reference without scripts and with everything escaped', () => {
    const html = renderDocsHtml(doc);
    expect(html).toContain('/api/v1/models/{slug}');
    expect(html).toContain('openapi.json');
    expect(html).not.toMatch(/<script/i);
    const evil = renderDocsHtml({
      ...doc,
      info: { ...doc.info, title: '<img src=x onerror=alert(1)>', description: '"><b>x</b>' },
    });
    expect(evil).not.toContain('<img src=x');
    expect(evil).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('route files and the registry stay in sync', () => {
  /** src/app/api/v1/models/[slug]/pricing/route.ts -> /models/{slug}/pricing */
  const routePaths = (() => {
    const base = path.join(process.cwd(), 'src', 'app', 'api', 'v1');
    const out: string[] = [];
    const walk = (dir: string, rel: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full, `${rel}/${name}`);
        else if (name === 'route.ts') out.push(rel || '/');
      }
    };
    walk(base, '');
    return out.map((r) => r.replace(/\[(\w+)\]/g, '{$1}')).sort();
  })();

  it('every route.ts is documented and every documented endpoint has a route', () => {
    expect(routePaths).toEqual(
      Object.values(endpoints)
        .map((e) => e.path)
        .sort(),
    );
  });
});
