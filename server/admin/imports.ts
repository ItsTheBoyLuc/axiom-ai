import type { Prisma, PrismaClient } from '../../prisma/generated/client';
import { loadBundle, protectExisting } from '../../prisma/seed/load';
import { validateBundle } from '../../prisma/seed/schemas';
import { ApiError } from '../api/http';
import { recordAudit } from '../audit';
import { isoDateTime } from '../db/mappers';
import type { StagedDiff } from '../jobs/sync-run';
import { DEFINITIONS, isAdminEntity, type AdminEntity, type SeedRecord } from './definitions';
import type { SaveContext } from './records';

/**
 * The approval side of the staging area (docs/PROMPT.md 9). An import is only ever PENDING,
 * APPROVED or REJECTED; approving publishes it through the same loader as every other write.
 * The trust guard is checked here BEFORE the write: an import that would replace a higher-trust
 * record is refused (409, `requiresOverride`) unless the admin explicitly confirms the override,
 * and the override is recorded in the audit log.
 */

export type ImportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ImportSummary = {
  id: string;
  entityType: string;
  title: string;
  key: string;
  kind: 'new' | 'update';
  trust: 'ok' | 'downgrade';
  status: ImportStatus;
  source: string;
  runId: string;
  stagedAt: string;
  reviewedAt: string | null;
};
export type ImportDetail = ImportSummary & {
  payload: SeedRecord;
  changes: StagedDiff['changes'];
  /** The stored record this would replace, if any. */
  existing: SeedRecord | null;
};
export type ImportPage = { rows: ImportSummary[]; total: number; page: number; pageSize: number };
export const IMPORT_PAGE_SIZE = 25;

const diffOf = (v: unknown): StagedDiff => v as StagedDiff;
const titleOf = (payload: SeedRecord): string =>
  String(payload.title ?? payload.name ?? payload.slug ?? 'Untitled');

type Row = Prisma.ImportedRecordGetPayload<{
  include: { run: { select: { id: true; startedAt: true; source: { select: { name: true } } } } };
}>;

const summarise = (r: Row): ImportSummary => {
  const diff = diffOf(r.diff);
  return {
    id: r.id,
    entityType: r.entityType,
    title: titleOf(r.payload as SeedRecord),
    key: diff.key,
    kind: diff.kind,
    trust: diff.trust,
    status: r.status,
    source: r.run.source.name,
    runId: r.run.id,
    stagedAt: isoDateTime(r.run.startedAt),
    reviewedAt: r.reviewedAt ? isoDateTime(r.reviewedAt) : null,
  };
};
const include = {
  run: { select: { id: true, startedAt: true, source: { select: { name: true } } } },
} as const;

export async function listImports(
  db: PrismaClient,
  opts: { status?: ImportStatus; runId?: string; page?: number },
): Promise<ImportPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const where: Prisma.ImportedRecordWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.runId ? { runId: opts.runId } : {}),
  };
  const [rows, total] = await Promise.all([
    db.importedRecord.findMany({
      where,
      include,
      orderBy: [{ run: { startedAt: 'desc' } }, { id: 'asc' }],
      skip: (page - 1) * IMPORT_PAGE_SIZE,
      take: IMPORT_PAGE_SIZE,
    }),
    db.importedRecord.count({ where }),
  ]);
  return { rows: rows.map(summarise), total, page, pageSize: IMPORT_PAGE_SIZE };
}

export async function getImport(db: PrismaClient, id: string): Promise<ImportDetail | null> {
  const row = await db.importedRecord.findUnique({ where: { id }, include });
  if (!row) return null;
  const diff = diffOf(row.diff);
  let existing: SeedRecord | null = null;
  if (isAdminEntity(row.entityType)) {
    const def = DEFINITIONS[row.entityType];
    const eid = await def.findIdByKey(db, row.payload as SeedRecord);
    existing = eid ? await def.get(db, eid) : null;
  }
  return { ...summarise(row), payload: row.payload as SeedRecord, changes: diff.changes, existing };
}

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

/**
 * Publishes a staged record. 404 unknown, 409 already decided / trust guard / identity clash,
 * 400 when the payload no longer validates (e.g. it references a model that was deleted since).
 */
export async function approveImport(
  db: PrismaClient,
  id: string,
  opts: { override: boolean },
  ctx: SaveContext,
): Promise<{ id: string; entityId: string }> {
  const row = await db.importedRecord.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'import not found');
  if (row.status !== 'PENDING') {
    throw new ApiError(409, 'CONFLICT', `This import was already ${row.status.toLowerCase()}.`);
  }
  if (!isAdminEntity(row.entityType)) {
    throw new ApiError(400, 'VALIDATION', `Unsupported record type "${row.entityType}".`);
  }
  const entity: AdminEntity = row.entityType;
  const def = DEFINITIONS[entity];

  const candidate = {
    ...(row.payload as SeedRecord),
    collectedAt: new Date().toISOString(),
    isDemo: false,
  };
  const result = validateBundle(
    { [def.seedFile]: [candidate] },
    { allowDemo: false, known: await knownSlugs(db) },
  );
  if (!result.ok) {
    throw new ApiError(400, 'VALIDATION', 'The staged record is no longer valid', {
      issues: result.errors.map((e) => ({ path: e.path, message: e.message })),
    });
  }
  const parsed = (result.bundle[def.seedFile] as unknown as SeedRecord[])[0]!;

  const existingId = await def.findIdByKey(db, parsed);
  const before = existingId ? await def.get(db, existingId) : null;
  const guard = before
    ? protectExisting(
        {
          verificationStatus: String(before.verificationStatus),
          isDemo: before.isDemo === true,
        },
        { verificationStatus: String(parsed.verificationStatus), isDemo: false },
      )
    : null;
  if (guard && !opts.override) {
    throw new ApiError(
      409,
      'TRUST_GUARD',
      `This import would lower the trust of stored data (${guard}). Approve with an explicit override or reject it.`,
      { requiresOverride: true },
    );
  }
  const blocker = await def.conflicts?.(db, parsed, existingId);
  if (blocker) throw new ApiError(409, 'CONFLICT', blocker);

  let entityId = existingId ?? '';
  let after: SeedRecord = parsed;
  await loadBundle(db, result.bundle, {
    override: true, // the trust guard was applied above, with the admin's explicit choice
    afterWrite: async (tx) => {
      const written = await def.findIdByKey(tx, parsed);
      if (!written) throw new Error('imported record was not written');
      entityId = written;
      after = (await def.get(tx, written)) ?? parsed;
      // Claim the import inside the same transaction: a second approval of the same import (or an
      // approve racing a reject) finds it no longer PENDING and rolls everything back.
      const claimed = await tx.importedRecord.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED', reviewedBy: ctx.actorId, reviewedAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new ApiError(409, 'CONFLICT', 'This import was already decided.');
      await recordAudit(tx, {
        actorId: ctx.actorId,
        action: guard ? 'import.approve-override' : 'import.approve',
        entityType: 'imports',
        entityId: id,
        before,
        after: { ...after, _entity: entity, _trustOverride: guard ?? undefined },
        ip: ctx.ip,
      });
    },
  });

  await ctx.invalidate?.(def.tags(after));
  return { id, entityId };
}

export async function rejectImport(db: PrismaClient, id: string, ctx: SaveContext): Promise<void> {
  await db.$transaction(async (tx) => {
    const row = await tx.importedRecord.findUnique({ where: { id } });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'import not found');
    const claimed = await tx.importedRecord.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', reviewedBy: ctx.actorId, reviewedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new ApiError(409, 'CONFLICT', `This import was already ${row.status.toLowerCase()}.`);
    }
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'import.reject',
      entityType: 'imports',
      entityId: id,
      before: { entity: row.entityType, record: row.payload },
      ip: ctx.ip,
    });
  });
}
