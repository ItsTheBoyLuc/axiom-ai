import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SeedValidationError, runSeed } from '../../prisma/seed/seed';
import { buildSearchDocumentText } from '../../server/repositories/model-query';
import { newDb, resetDb } from './helpers';

const db = newDb();
const dirs: string[] = [];

const NOW = '2026-09-29T00:00:00Z';
const sourced = {
  sourceUrl: 'https://acme.test/docs',
  verificationStatus: 'OFFICIALLY_VERIFIED',
  verifiedAt: NOW,
  collectedAt: NOW,
  isDemo: false,
};

const provider = (over: Record<string, unknown> = {}) => ({
  slug: 'acme',
  name: 'Acme AI',
  description: 'Real provider',
  ...sourced,
  ...over,
});
const model = (over: Record<string, unknown> = {}) => ({
  slug: 'acme-1',
  provider: 'acme',
  name: 'Acme One',
  family: 'Acme',
  version: '1.0',
  description: 'A real model',
  categories: ['llm', 'coding'],
  releaseDate: '2026-02-01',
  contextWindow: 100000,
  openWeights: false,
  availability: 'CLOUD_API',
  deployment: ['cloud-api', 'proprietary'],
  pricingKind: 'paid',
  inputModalities: ['text'],
  outputModalities: ['text'],
  capabilities: [{ name: 'text-generation' }, { name: 'reasoning' }],
  ...sourced,
  ...over,
});
const fullSet = () => ({
  providers: [provider()],
  benchmarks: [
    {
      slug: 'bench-a',
      name: 'Bench A',
      category: 'reasoning',
      description: 'd',
      version: '1',
      ...sourced,
    },
  ],
  models: [model()],
  'benchmark-results': [
    {
      model: 'acme-1',
      benchmark: 'bench-a',
      score: 71.5,
      scoreUnit: '%',
      evaluationDate: '2026-03-01',
      modelVersion: '1.0',
      evaluationType: 'INDEPENDENT',
      ...sourced,
    },
  ],
  pricing: [
    {
      model: 'acme-1',
      pricingType: 'INPUT',
      price: 2.5,
      currency: 'USD',
      unit: 'per 1M tokens',
      effectiveFrom: '2026-02-01',
      isCurrent: true,
      ...sourced,
    },
    {
      model: 'acme-1',
      pricingType: 'OUTPUT',
      price: null,
      currency: 'USD',
      unit: 'per 1M tokens',
      effectiveFrom: '2026-02-01',
      isCurrent: true,
      ...sourced,
      verificationStatus: 'NOT_PUBLICLY_DISCLOSED',
      sourceUrl: null,
      verifiedAt: null,
    },
  ],
  releases: [
    {
      provider: 'acme',
      model: 'acme-1',
      kind: 'MAJOR',
      releaseDate: '2026-02-01',
      title: 'Acme One released',
      description: 'd',
      announcementUrl: 'https://acme.test/blog',
      ...sourced,
    },
  ],
  news: [
    {
      title: 'Acme announces One',
      summary: 's',
      publisher: 'Acme',
      articleUrl: 'https://acme.test/news/1',
      publicationDate: '2026-02-01T09:00:00Z',
      category: 'MODEL_RELEASES',
      isOfficial: true,
      provider: 'acme',
      models: ['acme-1'],
      ...sourced,
    },
  ],
  publications: [
    {
      provider: 'acme',
      title: 'Acme paper',
      url: 'https://acme.test/paper',
      publishedAt: '2026-01-15',
      venue: 'Conf',
      ...sourced,
    },
  ],
});

/** Writes a data directory (one JSON file per key) and returns its path. */
function dataDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'axiom-seed-'));
  dirs.push(dir);
  mkdirSync(dir, { recursive: true });
  for (const [name, rows] of Object.entries(files))
    writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(rows));
  return dir;
}

const counts = async () => ({
  providers: await db.provider.count(),
  models: await db.model.count(),
  benchmarks: await db.benchmark.count(),
  results: await db.benchmarkResult.count(),
  pricing: await db.pricing.count(),
  releases: await db.release.count(),
  news: await db.newsArticle.count(),
  publications: await db.publication.count(),
  modelCapabilities: await db.modelCapability.count(),
});
const demoRows = async () =>
  (await db.provider.count({ where: { isDemo: true } })) +
  (await db.model.count({ where: { isDemo: true } })) +
  (await db.pricing.count({ where: { isDemo: true } })) +
  (await db.benchmarkResult.count({ where: { isDemo: true } })) +
  (await db.release.count({ where: { isDemo: true } })) +
  (await db.newsArticle.count({ where: { isDemo: true } }));

beforeEach(resetDb);
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
afterAll(() => db.$disconnect());

describe('loading real, sourced data', () => {
  it('writes every entity type with its sourcing fields and relations', async () => {
    const r = await runSeed(db, { dataDir: dataDir(fullSet()) });
    expect(r.demo).toBeNull();
    expect(r.data.counts).toMatchObject({
      providers: 1,
      models: 1,
      benchmarks: 1,
      benchmarkResults: 1,
      pricing: 2,
      releases: 1,
      news: 1,
      publications: 1,
    });

    expect(await counts()).toEqual({
      providers: 1,
      models: 1,
      benchmarks: 1,
      results: 1,
      pricing: 2,
      releases: 1,
      news: 1,
      publications: 1,
      modelCapabilities: 2,
    });
    const m = await db.model.findUniqueOrThrow({
      where: { slug: 'acme-1' },
      include: { provider: true },
    });
    expect(m).toMatchObject({
      sourceUrl: 'https://acme.test/docs',
      verificationStatus: 'OFFICIALLY_VERIFIED',
      isDemo: false,
      pricingKind: 'PAID',
    });
    expect(m.verifiedAt).toEqual(new Date(NOW));
    expect(m.categories).toEqual(['LLM', 'CODING']);
    expect(m.sortName).toBe('acme one');
    expect(m.searchDocument).toBe(
      buildSearchDocumentText({
        name: 'Acme One',
        family: 'Acme',
        providerName: 'Acme AI',
        description: 'A real model',
        capabilities: ['text-generation', 'reasoning'],
        categories: ['llm', 'coding'],
      }),
    );
    // NULL means "not publicly disclosed": never coerced to 0
    const out = await db.pricing.findFirstOrThrow({ where: { pricingType: 'OUTPUT' } });
    expect(out.price).toBeNull();
    const news = await db.newsArticle.findFirstOrThrow({ include: { models: true } });
    expect(news.models.map((x) => x.slug)).toEqual(['acme-1']);
  });

  it('is idempotent: running twice changes nothing', async () => {
    const dir = dataDir(fullSet());
    await runSeed(db, { dataDir: dir });
    const first = await counts();
    await runSeed(db, { dataDir: dir });
    expect(await counts()).toEqual(first);
  });

  it('applies updates from the data file, including removed capabilities', async () => {
    await runSeed(db, { dataDir: dataDir(fullSet()) });
    const changed = fullSet();
    changed.models = [
      model({ description: 'Revised description', capabilities: [{ name: 'text-generation' }] }),
    ];
    await runSeed(db, { dataDir: dataDir(changed) });
    const m = await db.model.findUniqueOrThrow({
      where: { slug: 'acme-1' },
      select: {
        description: true,
        capabilities: { select: { capability: { select: { name: true } } } },
      },
    });
    expect(m.description).toBe('Revised description');
    expect(m.capabilities.map((c) => c.capability.name)).toEqual(['text-generation']);
  });

  it('treats an empty or missing data directory as "no records"', async () => {
    const r = await runSeed(db, { dataDir: dataDir({}) });
    expect(r.data.counts).toEqual({});
    expect((await counts()).models).toBe(0);
    // taxonomy is still present
    expect(await db.capability.count()).toBe(11);
  });
});

describe('validation happens before any write', () => {
  it('rejects unsourced verified data and writes NOTHING (even the valid rows)', async () => {
    const bad = fullSet();
    bad.models = [model(), model({ slug: 'acme-2', name: 'Acme Two', sourceUrl: null })]; // verified, no source
    await expect(runSeed(db, { dataDir: dataDir(bad) })).rejects.toThrow(SeedValidationError);
    expect(await counts()).toEqual({
      providers: 0,
      models: 0,
      benchmarks: 0,
      results: 0,
      pricing: 0,
      releases: 0,
      news: 0,
      publications: 0,
      modelCapabilities: 0,
    });
  });

  it('reports every error with file, index and path', async () => {
    const bad = fullSet();
    bad.models = [model({ sourceUrl: null }), model({ slug: 'acme-3', provider: 'ghost' })];
    try {
      await runSeed(db, { dataDir: dataDir(bad) });
      expect.unreachable();
    } catch (e) {
      const err = e as SeedValidationError;
      expect(err).toBeInstanceOf(SeedValidationError);
      expect(err.source).toBe('data');
      expect(
        err.errors.some((x) => x.file === 'models' && x.index === 0 && x.path === 'sourceUrl'),
      ).toBe(true);
      expect(
        err.errors.some((x) => x.index === 1 && /unknown provider "ghost"/.test(x.message)),
      ).toBe(true);
      expect(err.message).toMatch(/models\.json\[0\] \.sourceUrl/);
    }
  });

  it('rejects malformed JSON', async () => {
    const dir = dataDir({});
    writeFileSync(path.join(dir, 'models.json'), '{ not json');
    await expect(runSeed(db, { dataDir: dir })).rejects.toThrow(/invalid JSON/);
  });

  it('rolls back the whole load if the database rejects a row midway (transaction)', async () => {
    const clash = fullSet();
    // Two CURRENT INPUT prices for the same model/unit violate the "one current price" index.
    clash.pricing = [
      {
        model: 'acme-1',
        pricingType: 'INPUT',
        price: 1,
        currency: 'USD',
        unit: 'per 1M tokens',
        effectiveFrom: '2026-02-01',
        isCurrent: true,
        ...sourced,
      },
      {
        model: 'acme-1',
        pricingType: 'INPUT',
        price: 2,
        currency: 'USD',
        unit: 'per 1M tokens',
        effectiveFrom: '2026-06-01',
        isCurrent: true,
        ...sourced,
      },
    ];
    await expect(runSeed(db, { dataDir: dataDir(clash) })).rejects.toThrow();
    expect((await counts()).providers).toBe(0); // provider and model written earlier in the same run were rolled back
    expect((await counts()).models).toBe(0);
  });
});

describe('demo data isolation', () => {
  it('a normal seed never creates demo rows', async () => {
    await runSeed(db, { dataDir: dataDir(fullSet()) });
    expect(await demoRows()).toBe(0);
  });

  it('a demo record in a real data file is rejected', async () => {
    const sneaky = fullSet();
    sneaky.models = [
      model({ isDemo: true, verificationStatus: 'UNVERIFIED', sourceUrl: null, verifiedAt: null }),
    ];
    await expect(runSeed(db, { dataDir: dataDir(sneaky) })).rejects.toThrow(/SEED_DEMO=true/);
    expect((await counts()).models).toBe(0);
  });

  it('demo: true loads the 16 fixtures and every row is flagged demo', async () => {
    const r = await runSeed(db, { dataDir: dataDir({}), demo: true });
    expect(r.demo!.counts).toMatchObject({ providers: 7, models: 16, benchmarks: 5 });
    const total = await counts();
    expect(total.models).toBe(16);
    expect(await db.model.count({ where: { isDemo: false } })).toBe(0);
    expect(await db.provider.count({ where: { isDemo: false } })).toBe(0);
    expect(await db.pricing.count({ where: { isDemo: false } })).toBe(0);
    expect(await db.benchmarkResult.count({ where: { isDemo: false } })).toBe(0);
    expect(await db.release.count({ where: { isDemo: false } })).toBe(0);
    expect(await db.newsArticle.count({ where: { isDemo: false } })).toBe(0);
    expect(await db.modelCapability.count({ where: { isDemo: false } })).toBe(0);
    expect(
      await db.model.count({
        where: { verificationStatus: { in: ['OFFICIALLY_VERIFIED', 'INDEPENDENTLY_EVALUATED'] } },
      }),
    ).toBe(0);
  });

  it('demo and real data can coexist without mixing', async () => {
    await runSeed(db, { dataDir: dataDir(fullSet()), demo: true });
    expect(await db.model.count({ where: { isDemo: false } })).toBe(1);
    expect(await db.model.count({ where: { isDemo: true } })).toBe(16);
  });
});

describe('trust guard: imports never silently downgrade data', () => {
  it('does not overwrite an OFFICIALLY_VERIFIED record with an UNVERIFIED one', async () => {
    await runSeed(db, { dataDir: dataDir(fullSet()) });
    const weaker = fullSet();
    weaker.providers = [
      provider({
        name: 'Renamed By Import',
        verificationStatus: 'UNVERIFIED',
        sourceUrl: null,
        verifiedAt: null,
      }),
    ];
    const r = await runSeed(db, { dataDir: dataDir(weaker) });
    expect(r.data.skipped).toEqual([
      expect.objectContaining({
        entity: 'Provider',
        key: 'acme',
        reason: expect.stringMatching(/OFFICIALLY_VERIFIED outranks incoming UNVERIFIED/),
      }),
    ]);
    expect((await db.provider.findUniqueOrThrow({ where: { slug: 'acme' } })).name).toBe('Acme AI');
  });

  it('allows an equal or higher trust import to update the record', async () => {
    await runSeed(db, {
      dataDir: dataDir({
        providers: [provider({ verificationStatus: 'PROVIDER_REPORTED', verifiedAt: null })],
      }),
    });
    await runSeed(db, { dataDir: dataDir({ providers: [provider({ name: 'Acme Corrected' })] }) }); // OFFICIALLY_VERIFIED > PROVIDER_REPORTED
    expect((await db.provider.findUniqueOrThrow({ where: { slug: 'acme' } })).name).toBe(
      'Acme Corrected',
    );
  });

  it('demo data can never overwrite a real record', async () => {
    await runSeed(db, {
      dataDir: dataDir({
        providers: [provider({ slug: 'demo-provider-a', name: 'Actually Real' })],
      }),
    });
    const r = await runSeed(db, { dataDir: dataDir({}), demo: true });
    expect(r.demo!.skipped).toEqual([
      expect.objectContaining({
        entity: 'Provider',
        key: 'demo-provider-a',
        reason: expect.stringMatching(/demo data/),
      }),
    ]);
    const p = await db.provider.findUniqueOrThrow({ where: { slug: 'demo-provider-a' } });
    expect(p).toMatchObject({ name: 'Actually Real', isDemo: false });
  });

  it('real data replaces demo data with the same key', async () => {
    await runSeed(db, { dataDir: dataDir({}), demo: true });
    await runSeed(db, {
      dataDir: dataDir({ providers: [provider({ slug: 'demo-provider-a', name: 'Now Real' })] }),
    });
    expect(
      await db.provider.findUniqueOrThrow({ where: { slug: 'demo-provider-a' } }),
    ).toMatchObject({ name: 'Now Real', isDemo: false });
  });
});
