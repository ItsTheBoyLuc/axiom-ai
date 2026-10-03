import { z } from 'zod';
import { readJson } from '../api/body';
import { ApiError } from '../api/http';
import { listAudit } from './audit-log';
import { isAdminEntity, type AdminEntity } from './definitions';
import type { AdminCtx, AdminResult } from './handler';
import { deleteRecord, getRecord, listRecords, saveRecord } from './records';
import { approveImport, getImport, listImports, rejectImport, type ImportStatus } from './imports';
import {
  createSource,
  deleteSource,
  getRun,
  getSource,
  listRuns,
  listSources,
  setSourceEnabled,
  updateSource,
} from './sync-sources';
import { ADAPTERS } from '../adapters';
import { deleteUser, listUsers, revokeUserSessions, setUserRole } from './users';

/**
 * Handler bodies for /api/v1/admin/*. Each takes the already-authorised context (see
 * handler.ts) and does its own input validation; the route files only bind them to a method.
 */

const page = z.coerce.number().int().min(1).max(100_000).catch(1);
const text = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .catch(undefined)
    .transform((v) => v?.trim() || undefined);

const entityOf = (ctx: AdminCtx): AdminEntity => {
  const e = ctx.params.entity ?? '';
  if (!isAdminEntity(e)) throw new ApiError(404, 'NOT_FOUND', 'Unknown record type');
  return e;
};
const idOf = (ctx: AdminCtx): string => {
  const id = ctx.params.id ?? '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new ApiError(404, 'NOT_FOUND', 'Record not found');
  return id;
};
const query = (ctx: AdminCtx) => new URL(ctx.request.url).searchParams;
const saveCtx = (ctx: AdminCtx) => ({
  actorId: ctx.user.id,
  ip: ctx.ip,
  invalidate: ctx.deps.invalidate,
});

const recordBody = z.record(z.string(), z.unknown());

export async function listRecordsRoute(ctx: AdminCtx): Promise<AdminResult> {
  const entity = entityOf(ctx);
  const sp = query(ctx);
  const data = await listRecords(ctx.deps.db, entity, {
    q: text(100).parse(sp.get('q') ?? undefined),
    page: page.parse(sp.get('page') ?? undefined),
  });
  return { data };
}

export async function createRecordRoute(ctx: AdminCtx): Promise<AdminResult> {
  const entity = entityOf(ctx);
  const body = await readJson(ctx.request, recordBody);
  return { status: 201, data: await saveRecord(ctx.deps.db, entity, null, body, saveCtx(ctx)) };
}

export async function getRecordRoute(ctx: AdminCtx): Promise<AdminResult> {
  const entity = entityOf(ctx);
  const id = idOf(ctx);
  const record = await getRecord(ctx.deps.db, entity, id);
  if (!record) throw new ApiError(404, 'NOT_FOUND', 'Record not found');
  return { data: { id, record } };
}

export async function updateRecordRoute(ctx: AdminCtx): Promise<AdminResult> {
  const entity = entityOf(ctx);
  const id = idOf(ctx);
  const body = await readJson(ctx.request, recordBody);
  return { data: await saveRecord(ctx.deps.db, entity, id, body, saveCtx(ctx)) };
}

export async function deleteRecordRoute(ctx: AdminCtx): Promise<AdminResult> {
  await deleteRecord(ctx.deps.db, entityOf(ctx), idOf(ctx), saveCtx(ctx));
  return { data: { ok: true } };
}

export async function listAuditRoute(ctx: AdminCtx): Promise<AdminResult> {
  const sp = query(ctx);
  return {
    data: await listAudit(ctx.deps.db, {
      entity: text(60).parse(sp.get('entity') ?? undefined),
      action: text(60).parse(sp.get('action') ?? undefined),
      page: page.parse(sp.get('page') ?? undefined),
    }),
  };
}

export async function listUsersRoute(ctx: AdminCtx): Promise<AdminResult> {
  const sp = query(ctx);
  return {
    data: await listUsers(ctx.deps.db, {
      q: text(100).parse(sp.get('q') ?? undefined),
      page: page.parse(sp.get('page') ?? undefined),
      now: ctx.deps.now?.(),
    }),
  };
}

const roleBody = z.strictObject({ role: z.enum(['USER', 'ADMIN']) });
export async function setUserRoleRoute(ctx: AdminCtx): Promise<AdminResult> {
  const { role } = await readJson(ctx.request, roleBody);
  await setUserRole(ctx.deps.db, { id: ctx.user.id, ip: ctx.ip }, idOf(ctx), role);
  return { data: { ok: true } };
}

export async function revokeSessionsRoute(ctx: AdminCtx): Promise<AdminResult> {
  const revoked = await revokeUserSessions(ctx.deps.db, { id: ctx.user.id, ip: ctx.ip }, idOf(ctx));
  return { data: { revoked } };
}

export async function deleteUserRoute(ctx: AdminCtx): Promise<AdminResult> {
  await deleteUser(ctx.deps.db, { id: ctx.user.id, ip: ctx.ip }, idOf(ctx));
  return { data: { ok: true } };
}

// ------------------------------------------------------------------ sync

const actorOf = (ctx: AdminCtx) => ({ id: ctx.user.id, ip: ctx.ip });
const sourceId = (ctx: AdminCtx) => idOf(ctx);

export async function listSourcesRoute(ctx: AdminCtx): Promise<AdminResult> {
  const [sources, worker] = await Promise.all([
    listSources(ctx.deps.db, ctx.deps.now?.()),
    ctx.deps.workerStatus(),
  ]);
  const adapters = Object.values(ADAPTERS).map((a) => ({
    kind: a.kind,
    label: a.label,
    help: a.help,
    exampleConfig: a.exampleConfig,
  }));
  return { data: { sources, worker, adapters } };
}

export async function createSourceRoute(ctx: AdminCtx): Promise<AdminResult> {
  const body = await readJson(ctx.request, recordBody);
  const row = await createSource(ctx.deps.db, actorOf(ctx), body);
  return { status: 201, data: { id: row.id } };
}

export async function getSourceRoute(ctx: AdminCtx): Promise<AdminResult> {
  const row = await getSource(ctx.deps.db, sourceId(ctx));
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'source not found');
  return { data: row };
}

export async function updateSourceRoute(ctx: AdminCtx): Promise<AdminResult> {
  const body = await readJson(ctx.request, recordBody);
  const row = await updateSource(ctx.deps.db, actorOf(ctx), sourceId(ctx), body);
  return { data: { id: row.id } };
}

export async function deleteSourceRoute(ctx: AdminCtx): Promise<AdminResult> {
  await deleteSource(ctx.deps.db, actorOf(ctx), sourceId(ctx));
  return { data: { ok: true } };
}

const enabledBody = z.strictObject({ enabled: z.boolean() });
export async function setSourceEnabledRoute(ctx: AdminCtx): Promise<AdminResult> {
  const { enabled } = await readJson(ctx.request, enabledBody);
  await setSourceEnabled(ctx.deps.db, actorOf(ctx), sourceId(ctx), enabled);
  return { data: { enabled } };
}

/** "Run now": queues a run for the worker (202). Disabled sources are not run. */
export async function runSourceRoute(ctx: AdminCtx): Promise<AdminResult> {
  const id = sourceId(ctx);
  const row = await getSource(ctx.deps.db, id);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'source not found');
  if (!row.enabled) {
    throw new ApiError(409, 'CONFLICT', 'This source is disabled. Enable it before running it.');
  }
  await ctx.deps.enqueueSync({ sourceId: id, trigger: 'manual', actorId: ctx.user.id, ip: ctx.ip });
  return { status: 202, data: { queued: true } };
}

export async function listRunsRoute(ctx: AdminCtx): Promise<AdminResult> {
  const sp = query(ctx);
  const source = sp.get('source') ?? undefined;
  return {
    data: await listRuns(ctx.deps.db, {
      sourceId: source && /^[A-Za-z0-9_-]{1,64}$/.test(source) ? source : undefined,
      page: page.parse(sp.get('page') ?? undefined),
    }),
  };
}

export async function getRunRoute(ctx: AdminCtx): Promise<AdminResult> {
  const run = await getRun(ctx.deps.db, idOf(ctx));
  if (!run) throw new ApiError(404, 'NOT_FOUND', 'run not found');
  return { data: run };
}

const IMPORT_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);
export async function listImportsRoute(ctx: AdminCtx): Promise<AdminResult> {
  const sp = query(ctx);
  const status = sp.get('status') ?? undefined;
  const run = sp.get('run') ?? undefined;
  return {
    data: await listImports(ctx.deps.db, {
      status: status && IMPORT_STATUSES.has(status) ? (status as ImportStatus) : undefined,
      runId: run && /^[A-Za-z0-9_-]{1,64}$/.test(run) ? run : undefined,
      page: page.parse(sp.get('page') ?? undefined),
    }),
  };
}

export async function getImportRoute(ctx: AdminCtx): Promise<AdminResult> {
  const row = await getImport(ctx.deps.db, idOf(ctx));
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'import not found');
  return { data: row };
}

const approveBody = z.strictObject({ override: z.boolean().default(false) });
export async function approveImportRoute(ctx: AdminCtx): Promise<AdminResult> {
  const { override } = await readJson(ctx.request, approveBody);
  return { data: await approveImport(ctx.deps.db, idOf(ctx), { override }, saveCtx(ctx)) };
}

export async function rejectImportRoute(ctx: AdminCtx): Promise<AdminResult> {
  await rejectImport(ctx.deps.db, idOf(ctx), saveCtx(ctx));
  return { data: { ok: true } };
}
