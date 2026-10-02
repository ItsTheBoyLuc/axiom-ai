import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { newDb, resetDb } from './helpers';

/** Section 2 enforced by the database itself, independent of application code. */
const db = newDb();

const provider = (over: Record<string, unknown> = {}) => ({
  name: 'P',
  slug: 'p',
  sortName: 'p',
  description: 'd',
  ...over,
});

const model = (providerId: string, over: Record<string, unknown> = {}) => ({
  providerId,
  name: 'M',
  slug: 'm',
  sortName: 'm',
  family: 'F',
  description: 'd',
  categories: ['LLM' as const],
  releaseDate: new Date('2026-01-01'),
  openWeights: false,
  availability: 'CLOUD_API' as const,
  ...over,
});

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe('sourced-record rules (section 2)', () => {
  it('rejects a verified record with no source URL', async () => {
    await expect(
      db.provider.create({
        data: provider({
          verificationStatus: 'OFFICIALLY_VERIFIED',
          verifiedAt: new Date(),
          sourceUrl: null,
        }),
      }),
    ).rejects.toThrow(/requires_source_chk/);
    await expect(
      db.provider.create({
        data: provider({ verificationStatus: 'PROVIDER_REPORTED', sourceUrl: null }),
      }),
    ).rejects.toThrow(/requires_source_chk/);
  });

  it('accepts UNVERIFIED and NOT_PUBLICLY_DISCLOSED without a source', async () => {
    await db.provider.create({ data: provider({ slug: 'a', verificationStatus: 'UNVERIFIED' }) });
    await db.provider.create({
      data: provider({ slug: 'b', verificationStatus: 'NOT_PUBLICLY_DISCLOSED' }),
    });
    expect(await db.provider.count()).toBe(2);
  });

  it('accepts a sourced record', async () => {
    await db.provider.create({
      data: provider({
        verificationStatus: 'OFFICIALLY_VERIFIED',
        sourceUrl: 'https://example.com/docs',
        verifiedAt: new Date(),
      }),
    });
    expect(await db.provider.count()).toBe(1);
  });

  it('requires verifiedAt for the two highest-trust statuses', async () => {
    await expect(
      db.provider.create({
        data: provider({
          verificationStatus: 'INDEPENDENTLY_EVALUATED',
          sourceUrl: 'https://example.com',
        }),
      }),
    ).rejects.toThrow(/verified_needs_date_chk/);
  });

  it('never lets demo data claim to be verified', async () => {
    await expect(
      db.provider.create({
        data: provider({
          isDemo: true,
          verificationStatus: 'OFFICIALLY_VERIFIED',
          sourceUrl: 'https://example.com',
          verifiedAt: new Date(),
        }),
      }),
    ).rejects.toThrow(/demo_not_verified_chk/);
  });

  it('applies to every factual table, not just providers', async () => {
    const p = await db.provider.create({ data: provider() });
    const m = await db.model.create({ data: model(p.id) });
    const bad = {
      verificationStatus: 'OFFICIALLY_VERIFIED' as const,
      verifiedAt: new Date(),
      sourceUrl: null,
    };
    await expect(db.model.create({ data: model(p.id, { slug: 'm2', ...bad }) })).rejects.toThrow(
      /requires_source_chk/,
    );
    await expect(
      db.pricing.create({
        data: {
          modelId: m.id,
          pricingType: 'INPUT',
          price: 1,
          currency: 'USD',
          unit: 'per 1M tokens',
          effectiveFrom: new Date('2026-01-01'),
          ...bad,
        },
      }),
    ).rejects.toThrow(/requires_source_chk/);
    await expect(
      db.release.create({
        data: {
          providerId: p.id,
          kind: 'MAJOR',
          releaseDate: new Date('2026-01-01'),
          title: 't',
          description: 'd',
          ...bad,
        },
      }),
    ).rejects.toThrow(/requires_source_chk/);
    await expect(
      db.newsArticle.create({
        data: {
          title: 't',
          summary: 's',
          publisher: 'x',
          articleUrl: 'https://e.test/1',
          publicationDate: new Date(),
          category: 'RESEARCH',
          ...bad,
        },
      }),
    ).rejects.toThrow(/requires_source_chk/);
  });
});

describe('pricing rules', () => {
  const price = (modelId: string, over: Record<string, unknown> = {}) => ({
    modelId,
    pricingType: 'INPUT' as const,
    price: 1,
    currency: 'USD',
    unit: 'per 1M tokens',
    effectiveFrom: new Date('2026-01-01'),
    ...over,
  });

  it('allows a NULL price (not publicly disclosed) but never a negative one', async () => {
    const p = await db.provider.create({ data: provider() });
    const m = await db.model.create({ data: model(p.id) });
    await db.pricing.create({ data: price(m.id, { price: null }) });
    await expect(
      db.pricing.create({ data: price(m.id, { pricingType: 'OUTPUT', price: -1 }) }),
    ).rejects.toThrow(/price_nonneg_chk/);
  });

  it('allows only one CURRENT price per model, type and unit; history stays', async () => {
    const p = await db.provider.create({ data: provider() });
    const m = await db.model.create({ data: model(p.id) });
    await db.pricing.create({
      data: price(m.id, { isCurrent: true, effectiveFrom: new Date('2026-06-01') }),
    });
    await expect(
      db.pricing.create({
        data: price(m.id, { isCurrent: true, effectiveFrom: new Date('2026-07-01') }),
      }),
    ).rejects.toThrow(/Pricing_one_current_idx|Unique constraint/);
    // A historical price for the same slot is fine.
    await db.pricing.create({
      data: price(m.id, {
        isCurrent: false,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-05-31'),
      }),
    });
    expect(await db.pricing.count({ where: { modelId: m.id } })).toBe(2);
  });

  it('rejects a current price that has ended, and a reversed date range', async () => {
    const p = await db.provider.create({ data: provider() });
    const m = await db.model.create({ data: model(p.id) });
    await expect(
      db.pricing.create({
        data: price(m.id, { isCurrent: true, effectiveTo: new Date('2026-02-01') }),
      }),
    ).rejects.toThrow(/current_open_chk/);
    await expect(
      db.pricing.create({
        data: price(m.id, {
          isCurrent: false,
          effectiveFrom: new Date('2026-03-01'),
          effectiveTo: new Date('2026-02-01'),
        }),
      }),
    ).rejects.toThrow(/dates_chk/);
  });
});

describe('search columns', () => {
  it('generates the tsvector from searchDocument and supports trigram substring search', async () => {
    const p = await db.provider.create({ data: provider() });
    await db.model.create({
      data: model(p.id, { searchDocument: 'quantum llama\nreasoning engine' }),
    });
    const fts = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM "Model" WHERE "searchTsv" @@ plainto_tsquery('simple', 'llama')`;
    expect(Number(fts[0]!.n)).toBe(1);
    const trgm = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM "Model" WHERE "searchDocument" ILIKE ${'%uantum ll%'}`;
    expect(Number(trgm[0]!.n)).toBe(1);
  });

  it('orders sortName by byte value ("C" collation), like the in-memory code', async () => {
    const p = await db.provider.create({ data: provider() });
    for (const [i, n] of ['banana', 'Zed', 'apple'].entries()) {
      await db.model.create({ data: model(p.id, { slug: `s${i}`, name: n, sortName: n }) });
    }
    const rows = await db.model.findMany({
      orderBy: { sortName: 'asc' },
      select: { sortName: true },
    });
    expect(rows.map((r) => r.sortName)).toEqual(['Zed', 'apple', 'banana']); // uppercase sorts first in "C"
  });
});
