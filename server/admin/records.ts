import type { PrismaClient } from '../../prisma/generated/client';
import { loadBundle } from '../../prisma/seed/load';
import { validateBundle } from '../../prisma/seed/schemas';
import { recordAudit } from '../audit';
import { ApiError } from '../api/http';
import { DEFINITIONS, type AdminEntity, type RecordSummary, type SeedRecord } from './definitions';

/**
 * The admin record layer: list / read / save / delete for every editable entity.
 *
 * Saving does NOT write to the tables directly. A record goes through the same Zod schema and
 * the same loader as seed files and approved imports, so the data-integrity rules (source URL,
 * verification status, no demo data in real data, valid references) hold for admin edits too, and
 * the audit entry commits in the same transaction as the change.
 */

export type SaveContext = {
  actorId: string;
  ip: string | null;
  /** Called after commit with the cache tags the write made stale. */
  invalidate?: (tags: string[]) => Promise<void>;
};

export type RecordPage = { rows: RecordSummary[]; total: number; page: number; pageSize: number };

export const ADMIN_PAGE_SIZE = 25;

export async function listRecords(
  db: PrismaClient,
  entity: AdminEntity,
  opts: { q?: string; page?: number },
): Promise<RecordPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const { rows, total } = await DEFINITIONS[entity].list(
    db,
    (opts.q ?? '').slice(0, 100),
    (page - 1) * ADMIN_PAGE_SIZE,
    ADMIN_PAGE_SIZE,
  );
  return { rows, total, page, pageSize: ADMIN_PAGE_SIZE };
}

export async function getRecord(
  db: PrismaClient,
  entity: AdminEntity,
  id: string,
): Promise<SeedRecord | null> {
  return DEFINITIONS[entity].get(db, id);
}

/** Slugs that already exist, so one edited record may reference them (see validateBundle). */
async function knownSlugs(db: PrismaClient) {
  const [providers, models, benchmarks] = await Promise.all([
    db.provider.findMany({ select: { slug: true } }),
    db.model.findMany({ select: { slug: true } }),
    db.benchmark.findMany({ select: { slug: true } }),
  ]);
  return {
    providers: providers.map((p) => p.slug),
    models: models.map((m) => m.slug),
    benchmarks: benchmarks.map((b) => b.slug),
  };
}

const unique = (xs: string[]) => [...new Set(xs)];

/**
 * Creates (id = null) or updates one record. Admin writes are explicit approval, so the trust
 * guard is skipped (`override`), but the change is audited with the full before/after.
 * Throws ApiError 400 (validation, with every problem), 404 or 409 (key already taken).
 */
export async function saveRecord(
  db: PrismaClient,
  entity: AdminEntity,
  id: string | null,
  input: unknown,
  ctx: SaveContext,
): Promise<{ id: string; record: SeedRecord }> {
  const def = DEFINITIONS[entity];
  const before = id ? await def.get(db, id) : null;
  if (id && !before) throw new ApiError(404, 'NOT_FOUND', `${def.singular} not found`);

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ApiError(400, 'VALIDATION', 'The record must be a JSON object');
  }
  // Server-owned fields: the admin cannot back-date collection or smuggle in demo data.
  const candidate = { ...input, collectedAt: new Date().toISOString(), isDemo: false };

  const result = validateBundle(
    { [def.seedFile]: [candidate] },
    { allowDemo: false, known: await knownSlugs(db) },
  );
  if (!result.ok) {
    throw new ApiError(400, 'VALIDATION', 'The record is not valid', {
      issues: result.errors.map((e) => ({ path: e.path, message: e.message })),
    });
  }
  const parsed = (result.bundle[def.seedFile] as unknown as SeedRecord[])[0]!;
  const key = def.keyOf(parsed);
  const keyChanged = before !== null && def.keyOf(before) !== key;

  if (keyChanged && def.immutableKey) {
    throw new ApiError(400, 'VALIDATION', `The ${def.singular} identity cannot be changed`, {
      issues: [{ path: '', message: 'Create a new record instead of renaming this one.' }],
    });
  }
  const blocker = await def.conflicts?.(db, parsed, id);
  if (blocker) throw new ApiError(409, 'CONFLICT', blocker);
  const clash = await def.findIdByKey(db, parsed);
  if (clash && clash !== id) {
    throw new ApiError(409, 'CONFLICT', `A ${def.singular} with this identity already exists`);
  }

  let savedId = id ?? '';
  let after: SeedRecord = parsed;
  await loadBundle(db, result.bundle, {
    override: true,
    // A changed natural key writes a NEW row; the old one goes first, in the same transaction
    // (a current price would otherwise collide with itself on the one-current-price index).
    beforeWrite: async (tx) => {
      if (id && keyChanged) await def.remove(tx, id);
    },
    afterWrite: async (tx) => {
      const written = await def.findIdByKey(tx, parsed);
      if (!written) throw new Error(`${def.singular} was not written`);
      savedId = written;
      after = (await def.get(tx, written)) ?? parsed;
      await recordAudit(tx, {
        actorId: ctx.actorId,
        action: `${def.singular.replace(/ /g, '-')}.${id ? 'update' : 'create'}`,
        entityType: entity,
        entityId: written,
        before,
        after,
        ip: ctx.ip,
      });
    },
  });

  await ctx.invalidate?.(unique([...(before ? def.tags(before) : []), ...def.tags(after)]));
  return { id: savedId, record: after };
}

/** Deletes one record. ApiError 404, or 409 with the reason when something still depends on it. */
export async function deleteRecord(
  db: PrismaClient,
  entity: AdminEntity,
  id: string,
  ctx: SaveContext,
): Promise<void> {
  const def = DEFINITIONS[entity];
  const before = await def.get(db, id);
  if (!before) throw new ApiError(404, 'NOT_FOUND', `${def.singular} not found`);

  const refusal = await db.$transaction(async (tx) => {
    const why = await def.remove(tx, id);
    if (why) return why;
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: `${def.singular.replace(/ /g, '-')}.delete`,
      entityType: entity,
      entityId: id,
      before,
      ip: ctx.ip,
    });
    return null;
  });
  if (refusal) throw new ApiError(409, 'CONFLICT', refusal);
  await ctx.invalidate?.(def.tags(before));
}
