import { z } from 'zod';
import { readJson } from '../api/body';
import { ApiError } from '../api/http';
import { listAudit } from './audit-log';
import { isAdminEntity, type AdminEntity } from './definitions';
import type { AdminCtx, AdminResult } from './handler';
import { deleteRecord, getRecord, listRecords, saveRecord } from './records';
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
