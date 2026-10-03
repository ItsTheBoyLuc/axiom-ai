import { z } from 'zod';
import type { Prisma, PrismaClient } from '../../prisma/generated/client';
import { nextRunAt, normalizeSchedule, SCHEDULE_HELP } from '../../src/lib/sync/schedule';
import { ADAPTER_KINDS, getAdapter } from '../adapters';
import { ApiError } from '../api/http';
import { recordAudit } from '../audit';
import { isoDateTime, isoDateTimeOrNull } from '../db/mappers';

/**
 * Sync sources and runs for the admin dashboard: list with last/next run and counters, create /
 * edit / enable / disable / delete (configuration validated by the adapter's own schema), and
 * run history with the validation issues each run produced.
 */

export type SourceSummary = {
  id: string;
  name: string;
  kind: string;
  schedule: string;
  enabled: boolean;
  config: unknown;
  lastRun: {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    recordsSeen: number;
    recordsChanged: number;
    error: string | null;
    issues: number;
  } | null;
  nextRunAt: string | null;
  /** Runs in the last 7 days by outcome. */
  recent: { succeeded: number; partial: number; failed: number };
  pendingImports: number;
};

const sourceBody = z.strictObject({
  name: z.string().trim().min(1).max(80),
  kind: z.string().refine((k) => ADAPTER_KINDS.includes(k), 'Unknown source type'),
  schedule: z.string().max(40),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()),
});
export type SourceInput = z.input<typeof sourceBody>;

/** Validates and normalises a source body; throws ApiError 400 with every problem. */
export function parseSourceInput(input: unknown) {
  const base = sourceBody.safeParse(input);
  if (!base.success) {
    throw new ApiError(400, 'VALIDATION', 'The source is not valid', {
      issues: base.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  const { name, kind, schedule, enabled, config } = base.data;
  const issues: { path: string; message: string }[] = [];
  const normalized = normalizeSchedule(schedule);
  if (!normalized) issues.push({ path: 'schedule', message: `Use ${SCHEDULE_HELP}.` });
  const parsedConfig = getAdapter(kind)!.configSchema.safeParse(config);
  if (!parsedConfig.success) {
    for (const i of parsedConfig.error.issues) {
      issues.push({ path: `config.${i.path.join('.')}`.replace(/\.$/, ''), message: i.message });
    }
  }
  if (issues.length) throw new ApiError(400, 'VALIDATION', 'The source is not valid', { issues });
  return {
    name,
    kind,
    enabled,
    schedule: normalized!,
    // Store the normalised config (defaults applied), so what runs is exactly what was reviewed.
    config: (parsedConfig.success ? parsedConfig.data : {}) as unknown as Prisma.InputJsonValue,
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function listSources(db: PrismaClient, now = new Date()): Promise<SourceSummary[]> {
  const since = new Date(now.getTime() - WEEK_MS);
  const [sources, recent, pending] = await Promise.all([
    db.syncSource.findMany({
      orderBy: { name: 'asc' },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { _count: { select: { issues: true } } },
        },
      },
    }),
    db.syncRun.groupBy({
      by: ['sourceId', 'status'],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
    }),
    db.importedRecord.groupBy({
      by: ['runId'],
      where: { status: 'PENDING' },
      _count: { _all: true },
    }),
  ]);
  const runSource = new Map(
    (
      await db.syncRun.findMany({
        where: { id: { in: pending.map((p) => p.runId) } },
        select: { id: true, sourceId: true },
      })
    ).map((r) => [r.id, r.sourceId]),
  );
  const pendingBySource = new Map<string, number>();
  for (const p of pending) {
    const sid = runSource.get(p.runId);
    if (sid) pendingBySource.set(sid, (pendingBySource.get(sid) ?? 0) + p._count._all);
  }

  return sources.map((s) => {
    const last = s.runs[0] ?? null;
    const counts = { succeeded: 0, partial: 0, failed: 0 };
    for (const r of recent) {
      if (r.sourceId !== s.id) continue;
      if (r.status === 'SUCCEEDED') counts.succeeded += r._count._all;
      else if (r.status === 'PARTIAL') counts.partial += r._count._all;
      else if (r.status === 'FAILED') counts.failed += r._count._all;
    }
    const next = s.enabled ? nextRunAt(s.schedule, last?.startedAt ?? null, now) : null;
    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      schedule: s.schedule,
      enabled: s.enabled,
      config: s.config,
      lastRun: last && {
        id: last.id,
        startedAt: isoDateTime(last.startedAt),
        finishedAt: isoDateTimeOrNull(last.finishedAt),
        status: last.status,
        recordsSeen: last.recordsSeen,
        recordsChanged: last.recordsChanged,
        error: last.error,
        issues: last._count.issues,
      },
      nextRunAt: next ? isoDateTime(next) : null,
      recent: counts,
      pendingImports: pendingBySource.get(s.id) ?? 0,
    };
  });
}

export async function getSource(db: PrismaClient, id: string) {
  return db.syncSource.findUnique({ where: { id } });
}

type Actor = { id: string; ip: string | null };

export async function createSource(db: PrismaClient, actor: Actor, input: unknown) {
  const data = parseSourceInput(input);
  if (await db.syncSource.findUnique({ where: { name: data.name }, select: { id: true } })) {
    throw new ApiError(409, 'CONFLICT', 'A source with this name already exists.');
  }
  return db.$transaction(async (tx) => {
    const row = await tx.syncSource.create({ data });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'sync-source.create',
      entityType: 'sync-sources',
      entityId: row.id,
      after: row,
      ip: actor.ip,
    });
    return row;
  });
}

export async function updateSource(db: PrismaClient, actor: Actor, id: string, input: unknown) {
  const data = parseSourceInput(input);
  return db.$transaction(async (tx) => {
    const before = await tx.syncSource.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'source not found');
    const clash = await tx.syncSource.findUnique({
      where: { name: data.name },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      throw new ApiError(409, 'CONFLICT', 'A source with this name already exists.');
    }
    const row = await tx.syncSource.update({ where: { id }, data });
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'sync-source.update',
      entityType: 'sync-sources',
      entityId: id,
      before,
      after: row,
      ip: actor.ip,
    });
    return row;
  });
}

export async function setSourceEnabled(
  db: PrismaClient,
  actor: Actor,
  id: string,
  enabled: boolean,
) {
  await db.$transaction(async (tx) => {
    const before = await tx.syncSource.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'source not found');
    if (before.enabled === enabled) return;
    await tx.syncSource.update({ where: { id }, data: { enabled } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: enabled ? 'sync-source.enable' : 'sync-source.disable',
      entityType: 'sync-sources',
      entityId: id,
      before: { name: before.name, enabled: before.enabled },
      after: { name: before.name, enabled },
      ip: actor.ip,
    });
  });
}

export async function deleteSource(db: PrismaClient, actor: Actor, id: string) {
  await db.$transaction(async (tx) => {
    const before = await tx.syncSource.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'source not found');
    await tx.syncSource.delete({ where: { id } }); // runs, issues and staged imports cascade
    await recordAudit(tx, {
      actorId: actor.id,
      action: 'sync-source.delete',
      entityType: 'sync-sources',
      entityId: id,
      before,
      ip: actor.ip,
    });
  });
}

export type RunRow = {
  id: string;
  source: string;
  sourceId: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  recordsSeen: number;
  recordsChanged: number;
  error: string | null;
  issues: number;
  imports: number;
};
export type RunPage = { rows: RunRow[]; total: number; page: number; pageSize: number };
export const RUN_PAGE_SIZE = 20;

export async function listRuns(
  db: PrismaClient,
  opts: { sourceId?: string; page?: number },
): Promise<RunPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const where: Prisma.SyncRunWhereInput = opts.sourceId ? { sourceId: opts.sourceId } : {};
  const [rows, total] = await Promise.all([
    db.syncRun.findMany({
      where,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * RUN_PAGE_SIZE,
      take: RUN_PAGE_SIZE,
      include: {
        source: { select: { name: true } },
        _count: { select: { issues: true, imports: true } },
      },
    }),
    db.syncRun.count({ where }),
  ]);
  return {
    total,
    page,
    pageSize: RUN_PAGE_SIZE,
    rows: rows.map((r) => ({
      id: r.id,
      source: r.source.name,
      sourceId: r.sourceId,
      startedAt: isoDateTime(r.startedAt),
      finishedAt: isoDateTimeOrNull(r.finishedAt),
      status: r.status,
      recordsSeen: r.recordsSeen,
      recordsChanged: r.recordsChanged,
      error: r.error,
      issues: r._count.issues,
      imports: r._count.imports,
    })),
  };
}

export async function getRun(db: PrismaClient, id: string) {
  const run = await db.syncRun.findUnique({
    where: { id },
    include: {
      source: { select: { id: true, name: true, kind: true } },
      issues: { orderBy: { id: 'asc' }, take: 200 },
    },
  });
  return run;
}
