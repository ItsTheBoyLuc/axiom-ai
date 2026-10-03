import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hash } from '@node-rs/argon2';
import { createOrRotateAdmin } from '../../server/auth/admin-user';
import { authorize, userFromRequest } from '../../server/auth/authorize';
import { cookieConfig } from '../../server/auth/cookie';
import { hashToken } from '../../server/auth/crypto';
import { handleMe, handleSignIn, handleSignOut, type AuthDeps } from '../../server/auth/handlers';
import { hashPassword } from '../../server/auth/password';
import { createMemoryLimiter } from '../../server/auth/rate-limit';
import { SIGNIN_ACCOUNT_RULE, SIGNIN_IP_RULE, signIn } from '../../server/auth/service';
import {
  SESSION_REFRESH_AFTER_SECONDS,
  SESSION_TTL_SECONDS,
  createSession,
  deleteSession,
  deleteUserSessions,
  findSession,
} from '../../server/auth/sessions';
import { newDb, resetDb } from './helpers';

const db = newDb();
const cookie = cookieConfig('http://localhost:3000');
const PASSWORD = 'correct horse battery staple';

let deps: AuthDeps;
beforeEach(async () => {
  await resetDb();
  deps = {
    db,
    limiter: createMemoryLimiter(),
    cookie,
    allowedOrigins: ['http://localhost:3000'],
  };
});
afterAll(() => db.$disconnect());

async function makeUser(
  email: string,
  role: 'USER' | 'ADMIN' = 'USER',
  password: string | null = PASSWORD,
) {
  return db.user.create({
    data: { email, role, passwordHash: password ? await hashPassword(password) : null },
  });
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const withCookie = (token: string, extra: Record<string, string> = {}) => ({
  cookie: `${cookie.name}=${token}`,
  ...extra,
});
const tokenFrom = (res: Response) =>
  /axiom_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];

describe('sessions', () => {
  it('stores only a hash of the token, never the token', async () => {
    const u = await makeUser('a@x.test');
    const { token } = await createSession(db, u.id);
    const rows = await db.session.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sessionToken).toBe(hashToken(token));
    expect(rows[0]!.sessionToken).not.toBe(token);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('finds a live session with its user (and never the password hash)', async () => {
    const u = await makeUser('a@x.test', 'ADMIN');
    const { token } = await createSession(db, u.id);
    const s = await findSession(db, token);
    expect(s?.user).toEqual({ id: u.id, email: 'a@x.test', name: null, role: 'ADMIN' });
    expect(JSON.stringify(s)).not.toContain('argon2');
  });

  it('rejects missing, malformed and unknown tokens', async () => {
    expect(await findSession(db, undefined)).toBeNull();
    expect(await findSession(db, 'short')).toBeNull();
    expect(await findSession(db, 'x'.repeat(300))).toBeNull();
    expect(await findSession(db, 'a'.repeat(43))).toBeNull();
  });

  it('expires a session: it is refused and its row is deleted', async () => {
    const u = await makeUser('a@x.test');
    const past = new Date(Date.now() - (SESSION_TTL_SECONDS + 60) * 1000);
    const { token } = await createSession(db, u.id, past);
    expect(await findSession(db, token)).toBeNull();
    expect(await db.session.count()).toBe(0);
  });

  it('extends a session that has been in use for a while, but not a fresh one', async () => {
    const u = await makeUser('a@x.test');
    const fresh = await createSession(db, u.id);
    const before = (await db.session.findFirstOrThrow()).expires.getTime();
    await findSession(db, fresh.token);
    expect((await db.session.findFirstOrThrow()).expires.getTime()).toBe(before);

    await resetDb();
    const u2 = await makeUser('b@x.test');
    const old = await createSession(
      db,
      u2.id,
      new Date(Date.now() - (SESSION_REFRESH_AFTER_SECONDS + 3600) * 1000),
    );
    const oldExpires = (await db.session.findFirstOrThrow()).expires.getTime();
    const s = await findSession(db, old.token);
    expect(s!.expires.getTime()).toBeGreaterThan(oldExpires);
    expect((await db.session.findFirstOrThrow()).expires.getTime()).toBe(s!.expires.getTime());
  });

  it('can be revoked one at a time or for the whole user, and goes with the user', async () => {
    const u = await makeUser('a@x.test');
    const a = await createSession(db, u.id);
    const b = await createSession(db, u.id);
    await deleteSession(db, a.token);
    expect(await findSession(db, a.token)).toBeNull();
    expect(await findSession(db, b.token)).not.toBeNull();
    const c = await createSession(db, u.id);
    expect(await deleteUserSessions(db, u.id)).toBe(2);
    expect(await findSession(db, c.token)).toBeNull();
    const d = await createSession(db, u.id);
    await db.user.delete({ where: { id: u.id } });
    expect(await findSession(db, d.token)).toBeNull();
  });
});

describe('signIn', () => {
  it('opens a session for the right credentials, ignoring email case and spacing', async () => {
    await makeUser('ada@x.test');
    const r = await signIn(deps, { email: '  ADA@x.test ', password: PASSWORD, ip: '1.1.1.1' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.email).toBe('ada@x.test');
  });

  it('answers a wrong password, an unknown email and a passwordless account identically', async () => {
    await makeUser('ada@x.test');
    await makeUser('nopass@x.test', 'USER', null);
    const results = await Promise.all([
      signIn(deps, { email: 'ada@x.test', password: 'wrong password here', ip: '1.1.1.1' }),
      signIn(deps, { email: 'ghost@x.test', password: 'wrong password here', ip: '1.1.1.2' }),
      signIn(deps, { email: 'nopass@x.test', password: 'wrong password here', ip: '1.1.1.3' }),
    ]);
    for (const r of results) expect(r).toEqual({ ok: false, reason: 'invalid' });
    expect(await db.session.count()).toBe(0);
  });

  it('throttles an account after too many attempts, even with the right password', async () => {
    await makeUser('ada@x.test');
    for (let i = 0; i < SIGNIN_ACCOUNT_RULE.limit; i++) {
      await signIn(deps, {
        email: 'ada@x.test',
        password: 'wrong password here',
        ip: `9.9.9.${i}`,
      });
    }
    const r = await signIn(deps, { email: 'ada@x.test', password: PASSWORD, ip: '8.8.8.8' });
    expect(r).toMatchObject({ ok: false, reason: 'throttled' });
    if (!r.ok && r.reason === 'throttled') expect(r.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('throttles an address that tries many different accounts', async () => {
    for (let i = 0; i < SIGNIN_IP_RULE.limit; i++) {
      await signIn(deps, { email: `u${i}@x.test`, password: 'wrong password here', ip: '5.5.5.5' });
    }
    const r = await signIn(deps, {
      email: 'another@x.test',
      password: 'wrong password here',
      ip: '5.5.5.5',
    });
    expect(r).toMatchObject({ ok: false, reason: 'throttled' });
  });

  it('upgrades a hash made with weaker parameters on a successful sign-in', async () => {
    const weak = await hash(PASSWORD, {
      algorithm: 2,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    const u = await db.user.create({ data: { email: 'old@x.test', passwordHash: weak } });
    expect(
      (await signIn(deps, { email: 'old@x.test', password: PASSWORD, ip: '1.1.1.1' })).ok,
    ).toBe(true);
    const after = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash!;
    expect(after).not.toBe(weak);
    expect(after).toContain('m=19456,t=2,p=1');
  });
});

describe('POST /auth/sign-in', () => {
  it('signs an admin in with a hardened session cookie and sends them to /admin', async () => {
    await makeUser('root@x.test', 'ADMIN');
    const res = await handleSignIn(
      post('/api/v1/auth/sign-in', { email: 'root@x.test', password: PASSWORD }),
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const set = res.headers.get('set-cookie')!;
    for (const flag of ['HttpOnly', 'SameSite=Lax', 'Path=/']) expect(set).toContain(flag);
    const body = await res.json();
    expect(body.data.user).toMatchObject({ email: 'root@x.test', role: 'ADMIN' });
    expect(body.data.next).toBe('/admin');
    expect(JSON.stringify(body)).not.toMatch(/argon2|passwordHash/);
    expect(tokenFrom(res)).toHaveLength(43);
  });

  it('sends an ordinary user to the homepage and honours only same-site next paths', async () => {
    await makeUser('user@x.test');
    const ok = await handleSignIn(
      post('/api/v1/auth/sign-in', {
        email: 'user@x.test',
        password: PASSWORD,
        next: '/compare?models=a,b',
      }),
      deps,
    );
    expect((await ok.json()).data.next).toBe('/compare?models=a,b');
    const evil = await handleSignIn(
      post('/api/v1/auth/sign-in', {
        email: 'user@x.test',
        password: PASSWORD,
        next: 'https://evil.example/',
      }),
      deps,
    );
    expect((await evil.json()).data.next).toBe('/');
  });

  it('returns the same 401 body for a wrong password and an unknown account', async () => {
    await makeUser('user@x.test');
    const a = await handleSignIn(
      post('/api/v1/auth/sign-in', { email: 'user@x.test', password: 'not the password' }),
      deps,
    );
    const b = await handleSignIn(
      post('/api/v1/auth/sign-in', { email: 'ghost@x.test', password: 'not the password' }),
      deps,
    );
    expect([a.status, b.status]).toEqual([401, 401]);
    expect(await a.json()).toEqual(await b.json());
    expect(a.headers.get('set-cookie')).toBeNull();
  });

  it('answers 429 with Retry-After once throttled', async () => {
    await makeUser('user@x.test');
    let last: Response | undefined;
    for (let i = 0; i <= SIGNIN_ACCOUNT_RULE.limit; i++) {
      last = await handleSignIn(
        post('/api/v1/auth/sign-in', { email: 'user@x.test', password: 'not the password' }),
        deps,
      );
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await last!.json()).error.code).toBe('RATE_LIMITED');
  });

  it('validates the body: 415, 400 for bad JSON, bad email and unexpected fields', async () => {
    const hdr = { 'content-type': 'text/plain' };
    expect((await handleSignIn(post('/api/v1/auth/sign-in', 'x', hdr), deps)).status).toBe(415);
    expect((await handleSignIn(post('/api/v1/auth/sign-in', '{oops'), deps)).status).toBe(400);
    expect(
      (await handleSignIn(post('/api/v1/auth/sign-in', { email: 'nope', password: 'x' }), deps))
        .status,
    ).toBe(400);
    expect(
      (
        await handleSignIn(
          post('/api/v1/auth/sign-in', { email: 'a@b.co', password: 'x', role: 'ADMIN' }),
          deps,
        )
      ).status,
    ).toBe(400);
  });

  it('refuses a cross-origin request before looking at any credentials (CSRF)', async () => {
    await makeUser('user@x.test');
    const res = await handleSignIn(
      post(
        '/api/v1/auth/sign-in',
        { email: 'user@x.test', password: PASSWORD },
        { origin: 'https://evil.example' },
      ),
      deps,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('CROSS_ORIGIN');
    expect(await db.session.count()).toBe(0);
  });
});

describe('sign-out and me', () => {
  async function signedIn(email = 'a@x.test', role: 'USER' | 'ADMIN' = 'USER') {
    await makeUser(email, role);
    const res = await handleSignIn(
      post('/api/v1/auth/sign-in', { email, password: PASSWORD }),
      deps,
    );
    return tokenFrom(res)!;
  }

  it('me reports the signed-in user, and 401 without a session', async () => {
    const token = await signedIn();
    const me = await handleMe(
      new Request('http://localhost:3000/api/v1/auth/me', { headers: withCookie(token) }),
      deps,
    );
    expect(me.status).toBe(200);
    expect((await me.json()).data.user.email).toBe('a@x.test');
    const anon = await handleMe(new Request('http://localhost:3000/api/v1/auth/me'), deps);
    expect(anon.status).toBe(401);
    expect(anon.headers.get('cache-control')).toBe('no-store');
  });

  it('sign-out revokes the session on the server and clears the cookie', async () => {
    const token = await signedIn();
    const out = await handleSignOut(post('/api/v1/auth/sign-out', {}, withCookie(token)), deps);
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
    // The old cookie is dead even if someone kept a copy.
    const me = await handleMe(
      new Request('http://localhost:3000/api/v1/auth/me', { headers: withCookie(token) }),
      deps,
    );
    expect(me.status).toBe(401);
    expect(await db.session.count()).toBe(0);
  });

  it('sign-out is refused cross-origin', async () => {
    const token = await signedIn();
    const res = await handleSignOut(
      post('/api/v1/auth/sign-out', {}, withCookie(token, { origin: 'https://evil.example' })),
      deps,
    );
    expect(res.status).toBe(403);
    expect(await db.session.count()).toBe(1);
  });
});

describe('authorize (RBAC)', () => {
  const req = (token?: string) => ({ headers: new Headers(token ? withCookie(token) : {}) });

  it('401 without a session, 403 for a plain user, ok for an admin', async () => {
    const user = await makeUser('u@x.test');
    const admin = await makeUser('a@x.test', 'ADMIN');
    const ut = (await createSession(db, user.id)).token;
    const at = (await createSession(db, admin.id)).token;
    await expect(authorize(db, cookie, req(), 'ADMIN')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    await expect(authorize(db, cookie, req('a'.repeat(43)), 'ADMIN')).rejects.toMatchObject({
      status: 401,
    });
    await expect(authorize(db, cookie, req(ut), 'ADMIN')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect((await authorize(db, cookie, req(at), 'ADMIN')).role).toBe('ADMIN');
    expect((await authorize(db, cookie, req(ut), 'USER')).role).toBe('USER');
  });

  it('a demotion takes effect on the very next request (the role is read from the database)', async () => {
    const admin = await makeUser('a@x.test', 'ADMIN');
    const token = (await createSession(db, admin.id)).token;
    expect((await authorize(db, cookie, req(token), 'ADMIN')).id).toBe(admin.id);
    await db.user.update({ where: { id: admin.id }, data: { role: 'USER' } });
    await expect(authorize(db, cookie, req(token), 'ADMIN')).rejects.toMatchObject({ status: 403 });
  });

  it('userFromRequest ignores a forged role header or cookie value', async () => {
    const user = await makeUser('u@x.test');
    const token = (await createSession(db, user.id)).token;
    const r = { headers: new Headers({ ...withCookie(token), 'x-role': 'ADMIN' }) };
    expect((await userFromRequest(db, cookie, r))?.role).toBe('USER');
  });
});

describe('createOrRotateAdmin', () => {
  it('creates the first admin: Argon2id hash, audit entry, no secret in the audit log', async () => {
    const r = await createOrRotateAdmin(db, { email: ' Root@X.test ', password: PASSWORD });
    expect(r.action).toBe('created');
    const u = await db.user.findUniqueOrThrow({ where: { email: 'root@x.test' } });
    expect(u.role).toBe('ADMIN');
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
    const log = await db.auditLog.findMany();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      action: 'admin.create',
      entityType: 'User',
      entityId: u.id,
      actorId: null,
    });
    expect(JSON.stringify(log)).not.toContain(PASSWORD);
  });

  it('leaves an existing admin alone unless asked to rotate', async () => {
    await createOrRotateAdmin(db, { email: 'root@x.test', password: PASSWORD });
    const before = (await db.user.findUniqueOrThrow({ where: { email: 'root@x.test' } }))
      .passwordHash;
    const again = await createOrRotateAdmin(db, {
      email: 'root@x.test',
      password: 'another long passphrase',
    });
    expect(again.action).toBe('exists');
    expect(
      (await db.user.findUniqueOrThrow({ where: { email: 'root@x.test' } })).passwordHash,
    ).toBe(before);
    expect(await db.auditLog.count()).toBe(1);
  });

  it('rotating replaces the password, signs the admin out everywhere and is audited', async () => {
    const r1 = await createOrRotateAdmin(db, { email: 'root@x.test', password: PASSWORD });
    await createSession(db, r1.userId);
    const r2 = await createOrRotateAdmin(db, {
      email: 'root@x.test',
      password: 'a brand new passphrase',
      rotate: true,
    });
    expect(r2.action).toBe('rotated');
    expect(await db.session.count()).toBe(0);
    const ok = await signIn(deps, {
      email: 'root@x.test',
      password: 'a brand new passphrase',
      ip: '1.1.1.1',
    });
    expect(ok.ok).toBe(true);
    expect(
      (await signIn(deps, { email: 'root@x.test', password: PASSWORD, ip: '1.1.1.2' })).ok,
    ).toBe(false);
    expect(
      (await db.auditLog.findMany({ orderBy: { createdAt: 'asc' } })).map((l) => l.action),
    ).toEqual(['admin.create', 'admin.rotate']);
  });

  it('promotes an existing ordinary account', async () => {
    const u = await makeUser('user@x.test');
    const r = await createOrRotateAdmin(db, {
      email: 'user@x.test',
      password: 'a brand new passphrase',
    });
    expect(r).toEqual({ action: 'promoted', userId: u.id });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe('ADMIN');
  });

  it('refuses a password that fails the policy, before touching the database', async () => {
    await expect(
      createOrRotateAdmin(db, { email: 'root@x.test', password: 'short' }),
    ).rejects.toThrow(/too-short/);
    await expect(
      createOrRotateAdmin(db, { email: 'root@x.test', password: 'root-root-root-root' }),
    ).rejects.toThrow(/contains-email/);
    expect(await db.user.count()).toBe(0);
  });
});
