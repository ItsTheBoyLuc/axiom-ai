import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRoute, type AdminDeps } from '../../server/admin/handler';
import {
  approveImportRoute,
  createRecordRoute,
  createSourceRoute,
  deleteSourceRoute,
  getImportRoute,
  getRunRoute,
  getSourceRoute,
  listImportsRoute,
  listRunsRoute,
  listSourcesRoute,
  rejectImportRoute,
  runSourceRoute,
  setSourceEnabledRoute,
  updateSourceRoute,
  deleteRecordRoute,
  deleteUserRoute,
  getRecordRoute,
  listAuditRoute,
  listRecordsRoute,
  listUsersRoute,
  revokeSessionsRoute,
  setUserRoleRoute,
  updateRecordRoute,
} from '../../server/admin/routes';
import { deleteUser, setUserRole } from '../../server/admin/users';
import { cookieConfig } from '../../server/auth/cookie';
import { createMemoryLimiter } from '../../server/auth/rate-limit';
import { createSession } from '../../server/auth/sessions';
import { newDb, resetDb } from './helpers';

/**
 * RBAC for EVERY admin endpoint (docs/PROMPT.md 14, Phase 8): anonymous -> 401, signed-in user
 * -> 403, admin -> allowed; state-changing calls also need a same-origin request.
 */

const db = newDb();
const cookie = cookieConfig('http://localhost:3000');
const ORIGIN = 'http://localhost:3000';
const invalidate = vi.fn(async (_tags: string[]) => {});
const enqueueSync = vi.fn(async (_job: unknown) => {});

let deps: AdminDeps;
beforeEach(async () => {
  await resetDb();
  invalidate.mockClear();
  enqueueSync.mockClear();
  deps = {
    db,
    limiter: createMemoryLimiter(),
    cookie,
    allowedOrigins: [ORIGIN],
    invalidate,
    enqueueSync,
    workerStatus: async () => ({ online: true, lastSeen: '2026-10-03T12:00:00.000Z' }),
  };
});
afterAll(() => db.$disconnect());

const routes = () => ({
  'GET records': adminRoute(listRecordsRoute, () => deps),
  'POST records': adminRoute(createRecordRoute, () => deps),
  'GET record': adminRoute(getRecordRoute, () => deps),
  'PUT record': adminRoute(updateRecordRoute, () => deps),
  'DELETE record': adminRoute(deleteRecordRoute, () => deps),
  'GET audit': adminRoute(listAuditRoute, () => deps),
  'GET users': adminRoute(listUsersRoute, () => deps),
  'PUT user role': adminRoute(setUserRoleRoute, () => deps),
  'DELETE user sessions': adminRoute(revokeSessionsRoute, () => deps),
  'DELETE user': adminRoute(deleteUserRoute, () => deps),
  'GET sources': adminRoute(listSourcesRoute, () => deps),
  'POST sources': adminRoute(createSourceRoute, () => deps),
  'GET source': adminRoute(getSourceRoute, () => deps),
  'PUT source': adminRoute(updateSourceRoute, () => deps),
  'DELETE source': adminRoute(deleteSourceRoute, () => deps),
  'PUT source enabled': adminRoute(setSourceEnabledRoute, () => deps),
  'POST source run': adminRoute(runSourceRoute, () => deps),
  'GET runs': adminRoute(listRunsRoute, () => deps),
  'GET run': adminRoute(getRunRoute, () => deps),
  'GET imports': adminRoute(listImportsRoute, () => deps),
  'GET import': adminRoute(getImportRoute, () => deps),
  'POST import approve': adminRoute(approveImportRoute, () => deps),
  'POST import reject': adminRoute(rejectImportRoute, () => deps),
});

type Case = { name: keyof ReturnType<typeof routes>; method: string; url: string; body?: unknown };
const CASES: Case[] = [
  { name: 'GET records', method: 'GET', url: '/api/v1/admin/records/providers' },
  { name: 'POST records', method: 'POST', url: '/api/v1/admin/records/providers', body: {} },
  { name: 'GET record', method: 'GET', url: '/api/v1/admin/records/providers/x1' },
  { name: 'PUT record', method: 'PUT', url: '/api/v1/admin/records/providers/x1', body: {} },
  { name: 'DELETE record', method: 'DELETE', url: '/api/v1/admin/records/providers/x1' },
  { name: 'GET audit', method: 'GET', url: '/api/v1/admin/audit' },
  { name: 'GET users', method: 'GET', url: '/api/v1/admin/users' },
  {
    name: 'PUT user role',
    method: 'PUT',
    url: '/api/v1/admin/users/x1/role',
    body: { role: 'USER' },
  },
  { name: 'DELETE user sessions', method: 'DELETE', url: '/api/v1/admin/users/x1/sessions' },
  { name: 'DELETE user', method: 'DELETE', url: '/api/v1/admin/users/x1' },
  { name: 'GET sources', method: 'GET', url: '/api/v1/admin/sync/sources' },
  { name: 'POST sources', method: 'POST', url: '/api/v1/admin/sync/sources', body: {} },
  { name: 'GET source', method: 'GET', url: '/api/v1/admin/sync/sources/x1' },
  { name: 'PUT source', method: 'PUT', url: '/api/v1/admin/sync/sources/x1', body: {} },
  { name: 'DELETE source', method: 'DELETE', url: '/api/v1/admin/sync/sources/x1' },
  {
    name: 'PUT source enabled',
    method: 'PUT',
    url: '/api/v1/admin/sync/sources/x1/enabled',
    body: { enabled: false },
  },
  { name: 'POST source run', method: 'POST', url: '/api/v1/admin/sync/sources/x1/run', body: {} },
  { name: 'GET runs', method: 'GET', url: '/api/v1/admin/sync/runs' },
  { name: 'GET run', method: 'GET', url: '/api/v1/admin/sync/runs/x1' },
  { name: 'GET imports', method: 'GET', url: '/api/v1/admin/sync/imports' },
  { name: 'GET import', method: 'GET', url: '/api/v1/admin/sync/imports/x1' },
  {
    name: 'POST import approve',
    method: 'POST',
    url: '/api/v1/admin/sync/imports/x1/approve',
    body: {},
  },
  {
    name: 'POST import reject',
    method: 'POST',
    url: '/api/v1/admin/sync/imports/x1/reject',
    body: {},
  },
];
const PARAMS: Record<string, Record<string, string>> = {
  'GET records': { entity: 'providers' },
  'POST records': { entity: 'providers' },
  'GET record': { entity: 'providers', id: 'x1' },
  'PUT record': { entity: 'providers', id: 'x1' },
  'DELETE record': { entity: 'providers', id: 'x1' },
  'PUT user role': { id: 'x1' },
  'DELETE user sessions': { id: 'x1' },
  'DELETE user': { id: 'x1' },
  'GET source': { id: 'x1' },
  'PUT source': { id: 'x1' },
  'DELETE source': { id: 'x1' },
  'PUT source enabled': { id: 'x1' },
  'POST source run': { id: 'x1' },
  'GET run': { id: 'x1' },
  'GET import': { id: 'x1' },
  'POST import approve': { id: 'x1' },
  'POST import reject': { id: 'x1' },
};

function call(c: Case, headers: Record<string, string> = {}, extra: Record<string, string> = {}) {
  const init: RequestInit = {
    method: c.method,
    headers: {
      ...(c.method === 'GET' ? {} : { 'content-type': 'application/json', origin: ORIGIN }),
      ...headers,
    },
    ...(c.body === undefined ? {} : { body: JSON.stringify(c.body) }),
  };
  return routes()[c.name](new Request(`${ORIGIN}${c.url}`, init), {
    params: Promise.resolve({ ...PARAMS[c.name], ...extra }),
  });
}

async function sessionFor(role: 'USER' | 'ADMIN', email = `${role.toLowerCase()}@x.test`) {
  const user = await db.user.create({ data: { email, role } });
  const { token } = await createSession(db, user.id);
  return { user, headers: { cookie: `${cookie.name}=${token}` } };
}

describe('every admin endpoint enforces RBAC', () => {
  it.each(CASES)('$name: anonymous is 401', async (c) => {
    const res = await call(c);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it.each(CASES)('$name: a plain user is 403', async (c) => {
    const { headers } = await sessionFor('USER');
    const res = await call(c, headers);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });

  it.each(CASES)('$name: an expired or forged session is 401', async (c) => {
    expect((await call(c, { cookie: `${cookie.name}=not-a-real-token` })).status).toBe(401);
    const { user, headers } = await sessionFor('ADMIN', 'old@x.test');
    await db.session.updateMany({ where: { userId: user.id }, data: { expires: new Date(0) } });
    expect((await call(c, headers)).status).toBe(401);
  });

  it.each(CASES)('$name: an admin passes authorisation', async (c) => {
    const { headers } = await sessionFor('ADMIN');
    const res = await call(c, headers);
    // Past the gate: whatever happens next is the handler's own answer (200/400/404/409), never 401/403.
    expect([401, 403]).not.toContain(res.status);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('a demoted admin loses access at once (the role is read from the database)', async () => {
    const { user, headers } = await sessionFor('ADMIN');
    const c = CASES[0]!;
    expect((await call(c, headers)).status).toBe(200);
    await db.user.update({ where: { id: user.id }, data: { role: 'USER' } });
    expect((await call(c, headers)).status).toBe(403);
  });
});

describe('state-changing admin calls', () => {
  const writes = CASES.filter((c) => c.method !== 'GET');

  it.each(writes)('$name: refuses a cross-origin request (CSRF)', async (c) => {
    const { headers } = await sessionFor('ADMIN');
    const res = await call(c, { ...headers, origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('CROSS_ORIGIN');
    expect(await db.auditLog.count()).toBe(0);
  });

  it('POST refuses non-JSON bodies and unknown record types', async () => {
    const { headers } = await sessionFor('ADMIN');
    const bad = await routes()['POST records'](
      new Request(`${ORIGIN}/api/v1/admin/records/providers`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'text/plain', origin: ORIGIN },
        body: 'x',
      }),
      { params: Promise.resolve({ entity: 'providers' }) },
    );
    expect(bad.status).toBe(415);
    const unknown = await call(CASES[0]!, headers, { entity: 'users; DROP TABLE' });
    expect(unknown.status).toBe(404);
  });

  it('is rate limited per admin', async () => {
    const { headers } = await sessionFor('ADMIN');
    deps.limiter = { hit: async () => ({ allowed: false, remaining: 0, retryAfterSeconds: 7 }) };
    const res = await call(CASES[0]!, headers);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('7');
  });
});

describe('admin end to end through the handlers', () => {
  const provider = {
    slug: 'acme',
    name: 'Acme AI',
    description: 'A test provider.',
    sourceUrl: 'https://example.test/about',
    verificationStatus: 'OFFICIALLY_VERIFIED',
    verifiedAt: '2026-10-03T10:00:00.000Z',
  };

  it('creates, reads, updates, lists, audits and deletes a record', async () => {
    const { headers } = await sessionFor('ADMIN');
    const create = await call(
      { name: 'POST records', method: 'POST', url: '/x', body: provider },
      headers,
    );
    expect(create.status).toBe(201);
    const { id } = (await create.json()).data;
    expect(invalidate).toHaveBeenCalled();

    const get = await call({ name: 'GET record', method: 'GET', url: '/x' }, headers, { id });
    expect((await get.json()).data.record.slug).toBe('acme');

    const put = await call(
      { name: 'PUT record', method: 'PUT', url: '/x', body: { ...provider, name: 'Acme 2' } },
      headers,
      { id },
    );
    expect(put.status).toBe(200);

    const list = await call({ name: 'GET records', method: 'GET', url: '/x?q=acme' }, headers);
    expect((await list.json()).data.rows.map((r: { title: string }) => r.title)).toEqual([
      'Acme 2',
    ]);

    const audit = await call({ name: 'GET audit', method: 'GET', url: '/x' }, headers);
    const actions = (await audit.json()).data.rows.map((r: { action: string }) => r.action);
    expect(actions).toEqual(['provider.update', 'provider.create']);

    const del = await call({ name: 'DELETE record', method: 'DELETE', url: '/x' }, headers, { id });
    expect(del.status).toBe(200);
    expect(await db.provider.count()).toBe(0);
  });

  it('returns validation problems as 400 with details, never a stack trace', async () => {
    const { headers } = await sessionFor('ADMIN');
    const res = await call(
      { name: 'POST records', method: 'POST', url: '/x', body: { ...provider, sourceUrl: null } },
      headers,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
    expect(JSON.stringify(body)).not.toMatch(/at .*\.ts|node_modules/);
  });
});

describe('user administration rules', () => {
  const role = (id: string, r: 'USER' | 'ADMIN', headers: Record<string, string>) =>
    call({ name: 'PUT user role', method: 'PUT', url: '/x', body: { role: r } }, headers, { id });

  it('changes a role, revokes that user’s sessions, and audits it', async () => {
    const admin = await sessionFor('ADMIN');
    const other = await sessionFor('USER', 'other@x.test');
    const res = await role(other.user.id, 'ADMIN', admin.headers);
    expect(res.status).toBe(200);
    expect((await db.user.findUnique({ where: { id: other.user.id } }))?.role).toBe('ADMIN');
    expect(await db.session.count({ where: { userId: other.user.id } })).toBe(0);
    const audit = await db.auditLog.findFirst({ where: { action: 'user.role' } });
    expect(audit?.after).toMatchObject({ role: 'ADMIN' });
    expect(JSON.stringify(audit)).not.toContain('passwordHash');
  });

  it('never lets an admin change, revoke-own or delete their own account', async () => {
    const admin = await sessionFor('ADMIN');
    expect((await role(admin.user.id, 'USER', admin.headers)).status).toBe(409);
    const del = await call({ name: 'DELETE user', method: 'DELETE', url: '/x' }, admin.headers, {
      id: admin.user.id,
    });
    expect(del.status).toBe(409);
    expect((await db.user.findUnique({ where: { id: admin.user.id } }))?.role).toBe('ADMIN');
  });

  it('keeps at least one administrator (guard holds even if the actor is another, vanished admin)', async () => {
    // The route layer can only be reached by an admin, so the guard matters under a race: the
    // acting admin is gone by the time the change runs. Call the service directly to pin it.
    const last = await db.user.create({ data: { email: 'last@x.test', role: 'ADMIN' } });
    const actor = { id: 'vanished-admin', ip: null };
    await expect(setUserRole(db, actor, last.id, 'USER')).rejects.toMatchObject({ status: 409 });
    await expect(deleteUser(db, actor, last.id)).rejects.toMatchObject({ status: 409 });
    expect((await db.user.findUnique({ where: { id: last.id } }))?.role).toBe('ADMIN');
  });

  it('lists users without ever exposing password hashes', async () => {
    const admin = await sessionFor('ADMIN');
    await db.user.update({ where: { id: admin.user.id }, data: { passwordHash: 'argon-secret' } });
    const res = await call({ name: 'GET users', method: 'GET', url: '/x' }, admin.headers);
    const text = await res.text();
    expect(text).not.toContain('argon-secret');
    expect(JSON.parse(text).data.rows[0]).toMatchObject({ hasPassword: true, activeSessions: 1 });
  });

  it('revokes sessions and deletes another user', async () => {
    const admin = await sessionFor('ADMIN');
    const other = await sessionFor('USER', 'other@x.test');
    const rev = await call(
      { name: 'DELETE user sessions', method: 'DELETE', url: '/x' },
      admin.headers,
      { id: other.user.id },
    );
    expect((await rev.json()).data.revoked).toBe(1);
    const del = await call({ name: 'DELETE user', method: 'DELETE', url: '/x' }, admin.headers, {
      id: other.user.id,
    });
    expect(del.status).toBe(200);
    const unknown = await call(
      { name: 'DELETE user', method: 'DELETE', url: '/x' },
      admin.headers,
      {
        id: 'ghost',
      },
    );
    expect(unknown.status).toBe(404);
  });
});

describe('route files', () => {
  it('every /api/v1/admin route.ts exports only adminRoute-wrapped handlers', () => {
    const base = path.join(process.cwd(), 'src', 'app', 'api', 'v1', 'admin');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const full = path.join(dir, n);
        if (statSync(full).isDirectory()) walk(full);
        else if (n === 'route.ts') files.push(full);
      }
    };
    walk(base);
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const methods = [...src.matchAll(/export const (\w+) =/g)].map((m) => m[1]);
      const handlers = methods.filter((m) => m !== 'dynamic');
      expect(handlers.length, f).toBeGreaterThan(0);
      for (const m of handlers) {
        expect(src, `${f} ${m}`).toMatch(new RegExp(`export const ${m} = adminRoute\\(`));
      }
      expect(src, f).toContain("export const dynamic = 'force-dynamic'");
    }
  });
});

describe('sync administration through the handlers', () => {
  const source = {
    name: 'Example blog',
    kind: 'rss',
    schedule: 'every 6h',
    config: { feedUrl: 'https://blog.example.com/feed.xml', publisher: 'Example Lab' },
  };
  const c = (name: Case['name'], over: Partial<Case> = {}): Case => ({
    name,
    method: name.split(' ')[0]!,
    url: '/x',
    ...over,
  });

  it('creates a source, lists it with the worker status and adapter help, and queues a manual run', async () => {
    const admin = await sessionFor('ADMIN');
    const created = await call(c('POST sources', { body: source }), admin.headers);
    expect(created.status).toBe(201);
    const { id } = (await created.json()).data;

    const list = await (await call(c('GET sources'), admin.headers)).json();
    expect(list.data.sources[0]).toMatchObject({
      name: 'Example blog',
      schedule: 'every 6h',
      enabled: true,
    });
    expect(list.data.worker).toEqual({ online: true, lastSeen: '2026-10-03T12:00:00.000Z' });
    expect(list.data.adapters.map((a: { kind: string }) => a.kind).sort()).toEqual([
      'github-releases',
      'huggingface',
      'rss',
    ]);

    const run = await call(c('POST source run', { body: {} }), admin.headers, { id });
    expect(run.status).toBe(202);
    expect(enqueueSync).toHaveBeenCalledWith({
      sourceId: id,
      trigger: 'manual',
      actorId: admin.user.id,
      ip: 'unknown',
    });
  });

  it('will not run a disabled source, and reports a down queue as 503', async () => {
    const admin = await sessionFor('ADMIN');
    const { id } = (await (await call(c('POST sources', { body: source }), admin.headers)).json())
      .data;

    const off = await call(c('PUT source enabled', { body: { enabled: false } }), admin.headers, {
      id,
    });
    expect(off.status).toBe(200);
    const blocked = await call(c('POST source run', { body: {} }), admin.headers, { id });
    expect(blocked.status).toBe(409);
    expect(enqueueSync).not.toHaveBeenCalled();

    await call(c('PUT source enabled', { body: { enabled: true } }), admin.headers, { id });
    enqueueSync.mockRejectedValueOnce(
      Object.assign(new Error('x'), { name: 'ApiError', status: 503 }),
    );
    // A generic failure of the queue must never be a 200.
    const down = await call(c('POST source run', { body: {} }), admin.headers, { id });
    expect(down.status).toBeGreaterThanOrEqual(500);
  });

  it('strict bodies: unknown keys and wrong types are 400', async () => {
    const admin = await sessionFor('ADMIN');
    const { id } = (await (await call(c('POST sources', { body: source }), admin.headers)).json())
      .data;
    const extra = await call(
      c('PUT source enabled', { body: { enabled: true, x: 1 } }),
      admin.headers,
      { id },
    );
    expect(extra.status).toBe(400);
    const wrong = await call(c('PUT source enabled', { body: { enabled: 'yes' } }), admin.headers, {
      id,
    });
    expect(wrong.status).toBe(400);
    const approve = await call(
      c('POST import approve', { body: { override: true, sneaky: 1 } }),
      admin.headers,
      { id: 'x1' },
    );
    expect(approve.status).toBe(400);
  });

  it('unknown ids are 404 and malformed ids never reach the database', async () => {
    const admin = await sessionFor('ADMIN');
    for (const name of ['GET source', 'GET run', 'GET import'] as const) {
      expect((await call(c(name), admin.headers, { id: 'ghost' })).status, name).toBe(404);
      expect((await call(c(name), admin.headers, { id: "x'; DROP TABLE" })).status, name).toBe(404);
    }
    expect(
      (await call(c('POST import approve', { body: {} }), admin.headers, { id: 'ghost' })).status,
    ).toBe(404);
    expect(
      (await call(c('POST import reject', { body: {} }), admin.headers, { id: 'ghost' })).status,
    ).toBe(404);
  });

  it('listing endpoints ignore malformed filters instead of failing', async () => {
    const admin = await sessionFor('ADMIN');
    expect(
      (await call(c('GET imports', { url: '/x?status=NOPE&run=%27%3B--&page=abc' }), admin.headers))
        .status,
    ).toBe(200);
    expect(
      (await call(c('GET runs', { url: '/x?source=%27%3B--&page=-5' }), admin.headers)).status,
    ).toBe(200);
  });
});
