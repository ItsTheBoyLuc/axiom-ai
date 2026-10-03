import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRepositories } from '../../server/repositories';
import { buildSearchDocumentText } from '../../server/repositories/model-query';
import { defaultQuery } from '../../src/lib/models/query';
import { newDb, queryLoggingDb, seedDemo } from './helpers';

const db = newDb();
const logged = queryLoggingDb();
const repos = createRepositories(logged.client);

/** Runs `fn` and returns the SQL statements it executed. */
async function sqlOf(fn: () => Promise<unknown>): Promise<string[]> {
  logged.queries.length = 0;
  await fn();
  return [...logged.queries];
}

/** The column list of a SELECT statement (text between SELECT and the first FROM). */
const selectedColumns = (statement: string) => /^SELECT (.*?) FROM /is.exec(statement)?.[1] ?? '';

beforeAll(async () => {
  await seedDemo(db);
});
afterAll(async () => {
  await db.$disconnect();
  await logged.client.$disconnect();
});

describe('no N+1: query count does not grow with the amount of data returned', () => {
  it('list() runs the same number of queries for 3 rows or 16', async () => {
    const small = await sqlOf(() => repos.models.list({ ...defaultQuery, pageSize: 3 }));
    const large = await sqlOf(() => repos.models.list({ ...defaultQuery, pageSize: 48 }));
    expect(small.length).toBe(large.length);
    expect(large.length).toBeLessThanOrEqual(20);
  });

  it('holds for every sort, including the benchmark sort', async () => {
    for (const query of [
      { sort: 'alpha' as const },
      { sort: 'provider' as const },
      { sort: 'context' as const },
      { sort: 'benchmark' as const, benchmark: 'sample-benchmark-1' },
      { q: 'sample', category: ['coding' as const] },
    ]) {
      const a = await sqlOf(() => repos.models.list({ ...defaultQuery, ...query, pageSize: 2 }));
      const b = await sqlOf(() => repos.models.list({ ...defaultQuery, ...query, pageSize: 40 }));
      expect(a.length, JSON.stringify(query)).toBe(b.length);
    }
  });

  it('a profile is loaded in a fixed handful of queries', async () => {
    const one = await sqlOf(() => repos.models.getBySlug('sample-model-11'));
    expect(one.length).toBeLessThanOrEqual(8);
  });

  it('getManyBySlugs costs the same for 1 model or 16 (one round trip, not one per model)', async () => {
    const slugs = await repos.models.slugs();
    const one = await sqlOf(() => repos.models.getManyBySlugs(slugs.slice(0, 1)));
    const all = await sqlOf(() => repos.models.getManyBySlugs(slugs));
    expect(all.length).toBe(one.length);
  });

  it('suggest, related, featured, provider and benchmark listings stay bounded', async () => {
    expect((await sqlOf(() => repos.models.suggest('sample'))).length).toBeLessThanOrEqual(5);
    // related(): a fixed number of statements however many models it returns.
    const r1 = await sqlOf(() => repos.models.related('sample-model-1', 1));
    const r6 = await sqlOf(() => repos.models.related('sample-model-1', 6));
    expect(r1.length).toBe(r6.length);
    expect(r6.length).toBeLessThanOrEqual(20);
    const f1 = await sqlOf(() => repos.models.featured(1));
    const f16 = await sqlOf(() => repos.models.featured(16));
    expect(f1.length).toBe(f16.length);
    expect(f16.length).toBeLessThanOrEqual(12);
    const few = await sqlOf(() => repos.providers.list({ page: 1, pageSize: 2 }));
    const many = await sqlOf(() => repos.providers.list({ page: 1, pageSize: 50 }));
    expect(few.length).toBe(many.length);
    expect((await sqlOf(() => repos.benchmarks.list())).length).toBeLessThanOrEqual(3);
    // Every provider's latest release comes from one statement, not one per provider.
    expect((await sqlOf(() => repos.providers.listAll())).length).toBeLessThanOrEqual(3);
  });
});

describe('select only the columns that are needed', () => {
  it('never reads the search blob or the tsvector into results', async () => {
    const statements = [
      ...(await sqlOf(() => repos.models.list({ ...defaultQuery, q: 'sample' }))),
      ...(await sqlOf(() => repos.models.getBySlug('sample-model-1'))),
      ...(await sqlOf(() => repos.models.suggest('sample'))),
      ...(await sqlOf(() => repos.models.related('sample-model-1'))),
      ...(await sqlOf(() => repos.models.featured(3))),
    ].filter((s) => /^SELECT /i.test(s));
    expect(statements.length).toBeGreaterThan(5);
    for (const s of statements) {
      const cols = selectedColumns(s);
      expect(cols, s).not.toMatch(/searchDocument|searchTsv/);
    }
  });

  it('uses the search blob only in WHERE clauses (where the trigram index applies)', async () => {
    const statements = await sqlOf(() => repos.models.list({ ...defaultQuery, q: 'sample' }));
    expect(statements.some((s) => /WHERE .*"searchDocument"/is.test(s))).toBe(true);
  });

  it('never selects with a wildcard column list', async () => {
    const statements = [
      ...(await sqlOf(() => repos.models.getBySlug('sample-model-2'))),
      ...(await sqlOf(() => repos.models.list(defaultQuery))),
    ].filter((s) => /^SELECT /i.test(s));
    for (const s of statements) expect(selectedColumns(s), s).not.toMatch(/(^|,\s*)(\S+\.)?\*/);
  });

  it('list items carry no detail-only fields', async () => {
    const { items } = await repos.models.list({ ...defaultQuery, pageSize: 1 });
    expect(Object.keys(items[0]!)).not.toContain('specs');
    expect(Object.keys(items[0]!)).not.toContain('pricing');
    expect(Object.keys(items[0]!)).not.toContain('releaseHistory');
  });
});

describe('search text is matched literally (LIKE wildcards are escaped)', () => {
  beforeAll(async () => {
    // Give one model text containing the LIKE metacharacters so we can prove they match literally.
    const m = await db.model.findUniqueOrThrow({
      where: { slug: 'sample-model-1' },
      select: { name: true, family: true },
    });
    // Keep description and the search blob consistent, as the seed pipeline always does.
    const description = 'Runs at 100% with pure_python and back\\slash';
    await db.model.update({
      where: { slug: 'sample-model-1' },
      data: {
        description,
        searchDocument: buildSearchDocumentText({
          name: m.name,
          family: m.family,
          providerName: 'Demo Provider A',
          description,
          capabilities: [],
          categories: ['llm'],
        }),
      },
    });
  });

  const slugsFor = async (q: string) =>
    (await repos.models.list({ ...defaultQuery, q, pageSize: 48 })).items.map((m) => m.slug);

  it('matches a literal percent sign and underscore', async () => {
    expect(await slugsFor('100%')).toEqual(['sample-model-1']);
    expect(await slugsFor('pure_python')).toEqual(['sample-model-1']);
    expect(await slugsFor('back\\slash')).toEqual(['sample-model-1']);
  });

  it('does not treat them as wildcards', async () => {
    expect(await slugsFor('%')).toEqual(['sample-model-1']); // only the one document that really contains "%"
    expect(await slugsFor('pure-python')).toEqual([]);
    expect(await slugsFor('pure.python')).toEqual([]);
    expect(await slugsFor('1%0')).toEqual([]);
    expect(await slugsFor('p_re')).toEqual([]); // "_" must not match any single character
  });

  it('applies to suggestions too', async () => {
    expect((await repos.models.suggest('%', 10)).map((s) => s.slug)).toEqual(['sample-model-1']);
    expect(await repos.models.suggest('p_re', 10)).toEqual([]);
  });
});
