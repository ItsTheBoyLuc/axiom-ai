import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateBundle } from '../../prisma/seed/schemas';
import { ADMIN_ENTITIES, DEFINITIONS } from '../../server/admin/definitions';
import { deleteRecord, getRecord, listRecords, saveRecord } from '../../server/admin/records';
import { ApiError } from '../../server/api/http';
import { newDb, resetDb, seedDemo } from './helpers';

const db = newDb();
beforeEach(() => resetDb());
afterAll(() => db.$disconnect());

const SOURCE = 'https://example.test/docs';
const NOW = '2026-10-03T10:00:00.000Z';

const invalidate = vi.fn(async (_tags: string[]) => {});
const ctxFor = async () => {
  const actor = await db.user.upsert({
    where: { email: 'admin@x.test' },
    create: { email: 'admin@x.test', role: 'ADMIN' },
    update: {},
  });
  return { actorId: actor.id, ip: '203.0.113.9', invalidate };
};

const provider = (over: Record<string, unknown> = {}) => ({
  slug: 'acme',
  name: 'Acme AI',
  description: 'A test provider.',
  sourceUrl: SOURCE,
  verificationStatus: 'OFFICIALLY_VERIFIED',
  verifiedAt: NOW,
  ...over,
});
const model = (over: Record<string, unknown> = {}) => ({
  slug: 'acme-one',
  provider: 'acme',
  name: 'Acme One',
  family: 'Acme',
  description: 'A test model.',
  categories: ['llm'],
  releaseDate: '2026-01-02',
  openWeights: false,
  availability: 'CLOUD_API',
  sourceUrl: SOURCE,
  verificationStatus: 'OFFICIALLY_VERIFIED',
  verifiedAt: NOW,
  ...over,
});

async function expectApiError(p: Promise<unknown>, status: number) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(status);
  return err as ApiError;
}

describe('saveRecord', () => {
  it('creates a record, audits it with before/after, and reports the cache tags', async () => {
    const ctx = await ctxFor();
    const { id, record } = await saveRecord(db, 'providers', null, provider(), ctx);
    expect(record.slug).toBe('acme');
    expect((await db.provider.findUnique({ where: { id } }))?.name).toBe('Acme AI');

    const audit = await db.auditLog.findMany();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'provider.create',
      entityType: 'providers',
      entityId: id,
      actorId: ctx.actorId,
      ip: '203.0.113.9',
    });
    expect(audit[0]!.before).toBeNull();
    expect(audit[0]!.after).toMatchObject({ slug: 'acme' });
    expect(invalidate).toHaveBeenLastCalledWith(expect.arrayContaining(['providers', 'models']));
  });

  it('applies the data-integrity rules: no source, no verified status', async () => {
    const ctx = await ctxFor();
    const err = await expectApiError(
      saveRecord(db, 'providers', null, provider({ sourceUrl: null }), ctx),
      400,
    );
    expect(JSON.stringify(err.details)).toContain('sourceUrl');
    expect(await db.provider.count()).toBe(0);
    expect(await db.auditLog.count()).toBe(0);
  });

  it('ignores client-supplied isDemo/collectedAt: they are server-owned', async () => {
    const ctx = await ctxFor();
    const { id } = await saveRecord(
      db,
      'providers',
      null,
      provider({ isDemo: true, collectedAt: '2001-01-01T00:00:00.000Z' }),
      ctx,
    );
    const row = await db.provider.findUnique({ where: { id } });
    expect(row?.isDemo).toBe(false);
    expect(row!.collectedAt.getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it('rejects non-object bodies and unknown references', async () => {
    const ctx = await ctxFor();
    await expectApiError(saveRecord(db, 'providers', null, [provider()], ctx), 400);
    await expectApiError(saveRecord(db, 'providers', null, 'nope', ctx), 400);
    const err = await expectApiError(saveRecord(db, 'models', null, model(), ctx), 400);
    expect(JSON.stringify(err.details)).toContain('unknown provider');
  });

  it('refuses a duplicate identity with 409, and a missing id with 404', async () => {
    const ctx = await ctxFor();
    await saveRecord(db, 'providers', null, provider(), ctx);
    await expectApiError(saveRecord(db, 'providers', null, provider(), ctx), 409);
    await expectApiError(saveRecord(db, 'providers', 'does-not-exist', provider(), ctx), 404);
  });

  it('updates in place and keeps a slug immutable', async () => {
    const ctx = await ctxFor();
    const { id } = await saveRecord(db, 'providers', null, provider(), ctx);
    await saveRecord(db, 'providers', id, provider({ name: 'Acme Intelligence' }), ctx);
    expect((await db.provider.findUnique({ where: { id } }))?.name).toBe('Acme Intelligence');
    expect(await db.provider.count()).toBe(1);

    const err = await expectApiError(
      saveRecord(db, 'providers', id, provider({ slug: 'acme-2' }), ctx),
      400,
    );
    expect(err.message).toContain('identity');
    expect((await db.provider.findUnique({ where: { id } }))?.slug).toBe('acme');

    const upd = await db.auditLog.findFirst({ where: { action: 'provider.update' } });
    expect(upd?.before).toMatchObject({ name: 'Acme AI' });
    expect(upd?.after).toMatchObject({ name: 'Acme Intelligence' });
  });

  it('lets an explicit admin edit downgrade a verified record (override), and audits it', async () => {
    const ctx = await ctxFor();
    const { id } = await saveRecord(db, 'providers', null, provider(), ctx);
    await saveRecord(
      db,
      'providers',
      id,
      provider({ verificationStatus: 'UNVERIFIED', sourceUrl: null, verifiedAt: null }),
      ctx,
    );
    expect((await db.provider.findUnique({ where: { id } }))?.verificationStatus).toBe(
      'UNVERIFIED',
    );
    const upd = await db.auditLog.findFirst({ where: { action: 'provider.update' } });
    expect(upd?.before).toMatchObject({ verificationStatus: 'OFFICIALLY_VERIFIED' });
  });

  it('moves a record whose natural key changes (no stale duplicate is left behind)', async () => {
    const ctx = await ctxFor();
    await saveRecord(db, 'providers', null, provider(), ctx);
    await saveRecord(db, 'models', null, model(), ctx);
    const price = {
      model: 'acme-one',
      pricingType: 'INPUT',
      price: 1.5,
      currency: 'USD',
      unit: 'per 1M tokens',
      effectiveFrom: '2026-01-01',
      isCurrent: true,
      sourceUrl: SOURCE,
      verificationStatus: 'OFFICIALLY_VERIFIED',
      verifiedAt: NOW,
    };
    const created = await saveRecord(db, 'pricing', null, price, ctx);
    const moved = await saveRecord(
      db,
      'pricing',
      created.id,
      { ...price, effectiveFrom: '2026-02-01' },
      ctx,
    );
    expect(moved.id).not.toBe(created.id);
    const rows = await db.pricing.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(moved.id);
    // Colliding with another row's identity is a conflict, not a silent overwrite.
    const other = await saveRecord(db, 'pricing', null, { ...price, pricingType: 'OUTPUT' }, ctx);
    await expectApiError(
      saveRecord(db, 'pricing', other.id, { ...price, effectiveFrom: '2026-02-01' }, ctx),
      409,
    );
  });

  it('saves a model with capabilities and replaces them on edit', async () => {
    const ctx = await ctxFor();
    await saveRecord(db, 'providers', null, provider(), ctx);
    const caps = [{ name: 'tool-calling' }, { name: 'reasoning' }];
    const { id, record } = await saveRecord(db, 'models', null, model({ capabilities: caps }), ctx);
    expect((record.capabilities as unknown[]).length).toBe(2);
    await saveRecord(db, 'models', id, model({ capabilities: [{ name: 'reasoning' }] }), ctx);
    expect(await db.modelCapability.count({ where: { modelId: id } })).toBe(1);
  });
});

describe('deleteRecord', () => {
  it('refuses to delete a provider that still has models, then deletes once empty', async () => {
    const ctx = await ctxFor();
    const p = await saveRecord(db, 'providers', null, provider(), ctx);
    const m = await saveRecord(db, 'models', null, model(), ctx);
    const err = await expectApiError(deleteRecord(db, 'providers', p.id, ctx), 409);
    expect(err.message).toContain('1 model');
    expect(await db.provider.count()).toBe(1);

    await deleteRecord(db, 'models', m.id, ctx);
    await deleteRecord(db, 'providers', p.id, ctx);
    expect(await db.provider.count()).toBe(0);
    const del = await db.auditLog.findMany({ where: { action: { endsWith: '.delete' } } });
    expect(del.map((a) => a.action).sort()).toEqual(['model.delete', 'provider.delete']);
    expect(del.every((a) => a.before !== null)).toBe(true);
  });

  it('404s for an unknown id and cascades a model’s prices', async () => {
    const ctx = await ctxFor();
    await expectApiError(deleteRecord(db, 'news', 'nope', ctx), 404);
    await saveRecord(db, 'providers', null, provider(), ctx);
    const m = await saveRecord(db, 'models', null, model(), ctx);
    await saveRecord(
      db,
      'pricing',
      null,
      {
        model: 'acme-one',
        pricingType: 'INPUT',
        price: null,
        currency: 'USD',
        unit: 'per 1M tokens',
        effectiveFrom: '2026-01-01',
        isCurrent: true,
        sourceUrl: null,
        verificationStatus: 'NOT_PUBLICLY_DISCLOSED',
      },
      ctx,
    );
    await deleteRecord(db, 'models', m.id, ctx);
    expect(await db.pricing.count()).toBe(0);
  });
});

describe('listRecords / getRecord', () => {
  it('pages and searches', async () => {
    const ctx = await ctxFor();
    await saveRecord(db, 'providers', null, provider(), ctx);
    await saveRecord(db, 'providers', null, provider({ slug: 'zeta', name: 'Zeta Labs' }), ctx);
    const all = await listRecords(db, 'providers', {});
    expect(all.total).toBe(2);
    expect(all.rows.map((r) => r.title)).toEqual(['Acme AI', 'Zeta Labs']);
    const hit = await listRecords(db, 'providers', { q: 'zeta' });
    expect(hit.rows.map((r) => r.title)).toEqual(['Zeta Labs']);
    expect((await listRecords(db, 'providers', { q: '%' })).total).toBe(0); // LIKE wildcard is literal
    expect((await listRecords(db, 'providers', { page: 99 })).rows).toEqual([]);
    expect(await getRecord(db, 'providers', 'nope')).toBeNull();
  });
});

describe('every entity round-trips', () => {
  it('get() output is a valid record for its own schema (mappers invert the loader)', async () => {
    await seedDemo(db);
    for (const entity of ADMIN_ENTITIES) {
      const def = DEFINITIONS[entity];
      const { rows, total } = await def.list(db, '', 0, 500);
      if (entity !== 'publications') expect(total, `${entity} has fixture rows`).toBeGreaterThan(0);
      for (const row of rows.slice(0, 40)) {
        const rec = await def.get(db, row.id);
        expect(rec, `${entity} ${row.id}`).not.toBeNull();
        // Demo fixtures can only be re-validated as demo data.
        const result = validateBundle(
          { [def.seedFile]: [{ ...rec, collectedAt: NOW }] },
          {
            allowDemo: true,
            known: {
              providers: (await db.provider.findMany()).map((x) => x.slug),
              models: (await db.model.findMany()).map((x) => x.slug),
              benchmarks: (await db.benchmark.findMany()).map((x) => x.slug),
            },
          },
        );
        expect(result.ok ? [] : result.errors, `${entity} ${row.title}`).toEqual([]);
        expect(await def.findIdByKey(db, rec!), `${entity} key lookup`).toBe(row.id);
      }
    }
  });
});
