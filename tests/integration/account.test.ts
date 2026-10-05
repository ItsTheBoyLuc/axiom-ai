import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  changePasswordRoute,
  deleteAccountRoute,
  deleteComparisonRoute,
  getPreferencesRoute,
  listComparisonsRoute,
  listRecentlyViewedRoute,
  listSavedModelsRoute,
  meRoute,
  putPreferencesRoute,
  recordViewRoute,
  saveComparisonRoute,
  saveModelRoute,
  unsaveModelRoute,
} from '../../server/account/routes';
import { MAX_RECENTLY_VIEWED, listRecentlyViewed, recordView } from '../../server/account/service';
import { saveRecord } from '../../server/admin/records';
import { cookieConfig } from '../../server/auth/cookie';
import type { GuardDeps } from '../../server/auth/guard';
import {
  handleSession,
  handleSignIn,
  handleSignUp,
  type AuthDeps,
} from '../../server/auth/handlers';
import { hashPassword } from '../../server/auth/password';
import { createMemoryLimiter } from '../../server/auth/rate-limit';
import { createSession, findSession } from '../../server/auth/sessions';
import { SIGNUP_IP_RULE } from '../../server/auth/signup';
import { MAX_SAVED_COMPARISONS } from '../../src/lib/account/schemas';
import { newDb, resetDb } from './helpers';

const db = newDb();
const cookie = cookieConfig('http://localhost:3000');
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct horse battery staple';

let deps: GuardDeps & AuthDeps;
beforeEach(async () => {
  await resetDb();
  deps = { db, limiter: createMemoryLimiter(), cookie, allowedOrigins: [ORIGIN] };
});
afterAll(() => db.$disconnect());

const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${url}`, {
    method,
    headers: {
      ...(method === 'GET' ? {} : { 'content-type': 'application/json', origin: ORIGIN }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

async function person(email: string, role: 'USER' | 'ADMIN' = 'USER') {
  const user = await db.user.create({
    data: { email, role, passwordHash: await hashPassword(PASSWORD) },
  });
  const { token } = await createSession(db, user.id);
  return { user, token, headers: { cookie: `${cookie.name}=${token}` } };
}

/** Two fictional providers with three models each, created through the admin record layer. */
async function catalogue() {
  const ctx = {
    actorId: (await person('seed@x.test', 'ADMIN')).user.id,
    ip: null as string | null,
  };
  const src = { sourceUrl: 'https://example.test/docs', verificationStatus: 'UNVERIFIED' };
  for (const p of ['acme', 'zeta']) {
    await saveRecord(
      db,
      'providers',
      null,
      { slug: p, name: p.toUpperCase(), description: 'x', ...src },
      ctx,
    );
    for (const n of [1, 2, 3]) {
      await saveRecord(
        db,
        'models',
        null,
        {
          slug: `${p}-${n}`,
          provider: p,
          name: `${p} ${n}`,
          family: p,
          description: 'x',
          categories: ['llm'],
          releaseDate: '2026-01-01',
          openWeights: false,
          availability: 'CLOUD_API',
          ...src,
        },
        ctx,
      );
    }
  }
}

const me = <T extends Parameters<typeof meRoute>[0]>(run: T) => meRoute(run, () => deps);
const call = (
  run: Parameters<typeof meRoute>[0],
  request: Request,
  params: Record<string, string> = {},
) => me(run)(request, { params: Promise.resolve(params) });
const json = async (res: Response) => (await res.json()) as { data?: any; error?: any };

describe('sign-up', () => {
  const signUp = (body: unknown, headers: Record<string, string> = {}) =>
    handleSignUp(req('POST', '/api/v1/auth/sign-up', body, headers), deps);

  it('creates a USER account, opens a session, and stores only a hash', async () => {
    const res = await signUp({ email: ' New@Example.com ', password: PASSWORD, name: ' Ada ' });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.user).toMatchObject({ email: 'new@example.com', name: 'Ada', role: 'USER' });
    expect(body.data.next).toBe('/account');

    const row = await db.user.findUniqueOrThrow({ where: { email: 'new@example.com' } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(row)).not.toContain(PASSWORD);
    expect(row.emailVerified).toBeNull();

    const token = /axiom_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
    expect((await findSession(db, token))?.user.email).toBe('new@example.com');
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/);
    expect(await db.auditLog.count({ where: { action: 'user.signup' } })).toBe(1);
  });

  it('can never create an administrator, whatever the body says', async () => {
    const res = await signUp({ email: 'x@example.com', password: PASSWORD, role: 'ADMIN' });
    expect(res.status).toBe(400); // strict body: unknown key
    const ok = await signUp({ email: 'x@example.com', password: PASSWORD });
    expect((await json(ok)).data.user.role).toBe('USER');
  });

  it('enforces the password policy with readable reasons, and stores nothing on failure', async () => {
    for (const [password, expected] of [
      ['short', /at least 12/],
      ['password1234', /too common/],
      ['aaaabbbbaaaa', /repeats too few/],
      ['ada.lovelace-secret', /email name/],
    ] as const) {
      const res = await signUp({ email: 'ada.lovelace@example.com', password });
      expect(res.status, password).toBe(400);
      const body = await json(res);
      expect(body.error.code).toBe('WEAK_PASSWORD');
      expect(JSON.stringify(body.error.details)).toMatch(expected);
    }
    expect(await db.user.count()).toBe(0);
  });

  it('a duplicate email (any case) is 409 and never touches the existing account', async () => {
    await signUp({ email: 'dup@example.com', password: PASSWORD });
    const before = await db.user.findUniqueOrThrow({ where: { email: 'dup@example.com' } });
    const again = await signUp({ email: 'DUP@example.com', password: 'another long password!' });
    expect(again.status).toBe(409);
    expect((await json(again)).error.code).toBe('EMAIL_TAKEN');
    const after = await db.user.findUniqueOrThrow({ where: { email: 'dup@example.com' } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('is rate limited per address, refuses other origins, bad JSON and bad emails', async () => {
    for (let i = 0; i < SIGNUP_IP_RULE.limit; i++) {
      const r = await signUp(
        { email: `u${i}@example.com`, password: PASSWORD },
        { 'x-forwarded-for': '203.0.113.5' },
      );
      expect(r.status).toBe(201);
    }
    const blocked = await signUp(
      { email: 'late@example.com', password: PASSWORD },
      { 'x-forwarded-for': '203.0.113.5' },
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
    const other = await signUp(
      { email: 'other@example.com', password: PASSWORD },
      { 'x-forwarded-for': '203.0.113.6' },
    );
    expect(other.status).toBe(201);

    expect(
      (
        await signUp(
          { email: 'x@example.com', password: PASSWORD },
          { origin: 'https://evil.example' },
        )
      ).status,
    ).toBe(403);
    expect((await signUp({ email: 'not-an-email', password: PASSWORD })).status).toBe(400);
    expect((await signUp('{ nope')).status).toBe(400);
  });

  it('the new account can sign in afterwards', async () => {
    await signUp({ email: 'login@example.com', password: PASSWORD });
    const res = await handleSignIn(
      req('POST', '/api/v1/auth/sign-in', { email: 'login@example.com', password: PASSWORD }),
      deps,
    );
    expect(res.status).toBe(200);
  });
});

describe('session endpoint', () => {
  it('answers 200 with user null for anonymous visitors, without touching the database', async () => {
    const res = await handleSession(req('GET', '/api/v1/auth/session'), deps);
    expect(res.status).toBe(200);
    expect((await json(res)).data).toEqual({ user: null, preferences: null, savedModels: null });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('returns the user and their preferences when signed in, and null for a dead token', async () => {
    const a = await person('a@x.test');
    await db.userPreference.create({
      data: {
        userId: a.user.id,
        theme: 'dark',
        preferredProviders: [],
        settings: { personalized: false },
      },
    });
    const ok = await json(await handleSession(req('GET', '/x', undefined, a.headers), deps));
    expect(ok.data.savedModels).toEqual([]);
    expect(ok.data.user).toMatchObject({ email: 'a@x.test', role: 'USER' });
    expect(ok.data.preferences).toEqual({
      theme: 'dark',
      preferredProviders: [],
      personalized: false,
    });
    expect(JSON.stringify(ok)).not.toContain('passwordHash');

    const dead = await json(
      await handleSession(
        req('GET', '/x', undefined, { cookie: `${cookie.name}=${'x'.repeat(40)}` }),
        deps,
      ),
    );
    expect(dead.data.user).toBeNull();
  });
});

describe('every /api/v1/me endpoint requires a signed-in user', () => {
  const cases: [
    string,
    Parameters<typeof meRoute>[0],
    string,
    string,
    unknown,
    Record<string, string>,
  ][] = [
    ['GET preferences', getPreferencesRoute, 'GET', '/api/v1/me/preferences', undefined, {}],
    ['PUT preferences', putPreferencesRoute, 'PUT', '/api/v1/me/preferences', {}, {}],
    ['GET saved models', listSavedModelsRoute, 'GET', '/api/v1/me/saved-models', undefined, {}],
    ['POST saved model', saveModelRoute, 'POST', '/api/v1/me/saved-models', {}, {}],
    [
      'DELETE saved model',
      unsaveModelRoute,
      'DELETE',
      '/api/v1/me/saved-models/x',
      undefined,
      { slug: 'x' },
    ],
    ['GET comparisons', listComparisonsRoute, 'GET', '/api/v1/me/comparisons', undefined, {}],
    ['POST comparison', saveComparisonRoute, 'POST', '/api/v1/me/comparisons', {}, {}],
    [
      'DELETE comparison',
      deleteComparisonRoute,
      'DELETE',
      '/api/v1/me/comparisons/x',
      undefined,
      { id: 'x' },
    ],
    [
      'GET recently viewed',
      listRecentlyViewedRoute,
      'GET',
      '/api/v1/me/recently-viewed',
      undefined,
      {},
    ],
    ['POST recently viewed', recordViewRoute, 'POST', '/api/v1/me/recently-viewed', {}, {}],
    ['PUT password', changePasswordRoute, 'PUT', '/api/v1/me/password', {}, {}],
    ['DELETE account', deleteAccountRoute, 'DELETE', '/api/v1/me', {}, {}],
  ];

  it.each(cases)(
    '%s: anonymous is 401, a forged token is 401',
    async (_n, run, method, url, body, params) => {
      const anon = await call(run, req(method, url, body), params);
      expect(anon.status).toBe(401);
      expect(anon.headers.get('cache-control')).toBe('no-store');
      const forged = await call(
        run,
        req(method, url, body, { cookie: `${cookie.name}=${'z'.repeat(40)}` }),
        params,
      );
      expect(forged.status).toBe(401);
    },
  );

  it.each(cases.filter((c) => c[2] !== 'GET'))(
    '%s: a cross-origin write is 403',
    async (_n, run, method, url, body, params) => {
      const a = await person('csrf@x.test');
      const res = await call(
        run,
        req(method, url, body, { ...a.headers, origin: 'https://evil.example' }),
        params,
      );
      expect(res.status).toBe(403);
      expect((await json(res)).error.code).toBe('CROSS_ORIGIN');
    },
  );

  it('every /api/v1/me route.ts is wrapped by meRoute', () => {
    const base = path.join(process.cwd(), 'src', 'app', 'api', 'v1', 'me');
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
      const handlers = [...src.matchAll(/export const (\w+) =/g)]
        .map((m) => m[1])
        .filter((m) => m !== 'dynamic');
      expect(handlers.length, f).toBeGreaterThan(0);
      for (const m of handlers)
        expect(src, `${f} ${m}`).toMatch(new RegExp(`export const ${m} = meRoute\\(`));
      expect(src, f).toContain("export const dynamic = 'force-dynamic'");
    }
  });
});

describe('preferences', () => {
  it('defaults, saves, validates providers, and is private per user', async () => {
    await catalogue();
    const a = await person('a@x.test');
    const b = await person('b@x.test');

    const first = await json(
      await call(getPreferencesRoute, req('GET', '/x', undefined, a.headers)),
    );
    expect(first.data).toEqual({ theme: null, preferredProviders: [], personalized: true });

    const put = await call(
      putPreferencesRoute,
      req(
        'PUT',
        '/x',
        { theme: 'light', preferredProviders: ['acme'], personalized: false },
        a.headers,
      ),
    );
    expect(put.status).toBe(200);
    const again = await json(
      await call(getPreferencesRoute, req('GET', '/x', undefined, a.headers)),
    );
    expect(again.data).toEqual({
      theme: 'light',
      preferredProviders: ['acme'],
      personalized: false,
    });
    const other = await json(
      await call(getPreferencesRoute, req('GET', '/x', undefined, b.headers)),
    );
    expect(other.data.preferredProviders).toEqual([]);

    for (const bad of [
      { theme: 'neon', preferredProviders: [], personalized: true },
      { theme: null, preferredProviders: ['ghost'], personalized: true },
      { theme: null, preferredProviders: ['acme', 'acme'], personalized: true },
      { theme: null, preferredProviders: [], personalized: true, extra: 1 },
      { theme: null, preferredProviders: [] },
    ]) {
      const r = await call(putPreferencesRoute, req('PUT', '/x', bad, a.headers));
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
    // Nothing changed after the failures.
    const still = await json(
      await call(getPreferencesRoute, req('GET', '/x', undefined, a.headers)),
    );
    expect(still.data.theme).toBe('light');
  });
});

describe('saved models', () => {
  it('saves idempotently, lists newest first, removes, and is private per user', async () => {
    await catalogue();
    const a = await person('a@x.test');
    const b = await person('b@x.test');
    const save = (slug: string, h = a.headers) =>
      call(saveModelRoute, req('POST', '/x', { slug }, h));

    expect((await save('acme-1')).status).toBe(201);
    expect((await save('acme-1')).status).toBe(201); // idempotent
    expect((await save('zeta-2')).status).toBe(201);
    expect(await db.savedModel.count()).toBe(2);

    const list = await json(
      await call(listSavedModelsRoute, req('GET', '/x', undefined, a.headers)),
    );
    expect(list.data.map((m: { slug: string }) => m.slug)).toEqual(['zeta-2', 'acme-1']);
    expect(list.data[0]).toMatchObject({ name: 'zeta 2', providerName: 'ZETA' });
    expect(
      (await json(await call(listSavedModelsRoute, req('GET', '/x', undefined, b.headers)))).data,
    ).toEqual([]);

    expect((await save('ghost')).status).toBe(404);
    expect((await save('Not A Slug')).status).toBe(400);

    // B cannot remove A's saved model: it only ever touches B's own rows.
    await call(unsaveModelRoute, req('DELETE', '/x', undefined, b.headers), { slug: 'acme-1' });
    expect(await db.savedModel.count()).toBe(2);
    await call(unsaveModelRoute, req('DELETE', '/x', undefined, a.headers), { slug: 'acme-1' });
    await call(unsaveModelRoute, req('DELETE', '/x', undefined, a.headers), { slug: 'acme-1' }); // idempotent
    expect(await db.savedModel.count()).toBe(1);
  });
});

describe('saved comparisons', () => {
  const save = (body: unknown, headers: Record<string, string>) =>
    call(saveComparisonRoute, req('POST', '/x', body, headers));

  it('saves, lists with reopen links, deletes, and keeps other people out', async () => {
    await catalogue();
    const a = await person('a@x.test');
    const b = await person('b@x.test');

    const created = await save(
      { name: ' Frontier picks ', models: ['acme-1', 'zeta-2', 'acme-3'] },
      a.headers,
    );
    expect(created.status).toBe(201);
    const { id } = (await json(created)).data;

    const list = (
      await json(await call(listComparisonsRoute, req('GET', '/x', undefined, a.headers)))
    ).data;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id,
      name: 'Frontier picks',
      href: '/compare?models=acme-1,zeta-2,acme-3',
    });
    expect(list[0].models.map((m: { slug: string }) => m.slug)).toEqual([
      'acme-1',
      'zeta-2',
      'acme-3',
    ]);
    expect(
      (await json(await call(listComparisonsRoute, req('GET', '/x', undefined, b.headers)))).data,
    ).toEqual([]);

    // Someone else's comparison looks exactly like a missing one.
    const foreign = await call(deleteComparisonRoute, req('DELETE', '/x', undefined, b.headers), {
      id,
    });
    expect(foreign.status).toBe(404);
    expect(await db.savedComparison.count()).toBe(1);
    const own = await call(deleteComparisonRoute, req('DELETE', '/x', undefined, a.headers), {
      id,
    });
    expect(own.status).toBe(200);
    expect(await db.savedComparison.count()).toBe(0);
    expect(
      (
        await call(deleteComparisonRoute, req('DELETE', '/x', undefined, a.headers), {
          id: "x'; DROP",
        })
      ).status,
    ).toBe(404);
  });

  it('validates the body: name, 2 to 4 distinct existing models, strict keys', async () => {
    await catalogue();
    const a = await person('a@x.test');
    for (const bad of [
      { name: '', models: ['acme-1', 'acme-2'] },
      { name: 'x'.repeat(81), models: ['acme-1', 'acme-2'] },
      { name: 'one', models: ['acme-1'] },
      { name: 'five', models: ['acme-1', 'acme-2', 'acme-3', 'zeta-1', 'zeta-2'] },
      { name: 'dup', models: ['acme-1', 'acme-1'] },
      { name: 'ghost', models: ['acme-1', 'ghost-model'] },
      { name: 'extra', models: ['acme-1', 'acme-2'], configuration: {} },
    ]) {
      expect((await save(bad, a.headers)).status, JSON.stringify(bad)).toBe(400);
    }
    expect(await db.savedComparison.count()).toBe(0);
  });

  it('caps the number of saved comparisons per person', async () => {
    await catalogue();
    const a = await person('a@x.test');
    await db.savedComparison.createMany({
      data: Array.from({ length: MAX_SAVED_COMPARISONS }, (_, i) => ({
        userId: a.user.id,
        name: `c${i}`,
        configuration: { models: ['acme-1', 'acme-2'] },
      })),
    });
    const over = await save({ name: 'one too many', models: ['acme-1', 'acme-2'] }, a.headers);
    expect(over.status).toBe(409);
    expect((await json(over)).error.code).toBe('LIMIT');
  });

  it('a model removed from the catalogue is left out when reopening', async () => {
    await catalogue();
    const a = await person('a@x.test');
    await save({ name: 'pair', models: ['acme-1', 'acme-2', 'zeta-1'] }, a.headers);
    await db.model.delete({ where: { slug: 'acme-2' } });
    const [row] = (
      await json(await call(listComparisonsRoute, req('GET', '/x', undefined, a.headers)))
    ).data;
    expect(row.models.map((m: { slug: string }) => m.slug)).toEqual(['acme-1', 'zeta-1']);
    expect(row.href).toBe('/compare?models=acme-1,zeta-1');
  });
});

describe('recently viewed', () => {
  it('records views newest first, bumps repeats, ignores unknown slugs, and stays bounded', async () => {
    await catalogue();
    const a = await person('a@x.test');
    const view = (slug: string) => call(recordViewRoute, req('POST', '/x', { slug }, a.headers));
    for (const s of ['acme-1', 'zeta-1', 'acme-2']) {
      expect((await view(s)).status).toBe(200);
      await new Promise((r) => setTimeout(r, 5));
    }
    await view('acme-1'); // moves to the front
    expect((await view('ghost')).status).toBe(200); // never an error
    const list = (
      await json(await call(listRecentlyViewedRoute, req('GET', '/x', undefined, a.headers)))
    ).data;
    expect(list.map((m: { slug: string }) => m.slug)).toEqual(['acme-1', 'acme-2', 'zeta-1']);
    expect(await db.recentlyViewed.count()).toBe(3);

    // The bound: only the newest entries are kept (a small limit makes it visible).
    await db.recentlyViewed.deleteMany();
    for (const slug of ['zeta-1', 'zeta-2', 'zeta-3']) {
      await recordView(db, a.user.id, slug, 2);
      await new Promise((r) => setTimeout(r, 5));
    }
    const kept = (await listRecentlyViewed(db, a.user.id)).map((m) => m.slug);
    expect(kept).toEqual(['zeta-3', 'zeta-2']);
    expect(MAX_RECENTLY_VIEWED).toBeGreaterThan(10);
  });
});

describe('password change', () => {
  const change = (body: unknown, headers: Record<string, string>) =>
    call(changePasswordRoute, req('PUT', '/x', body, headers));

  it('needs the current password, applies the policy, and signs every other device out', async () => {
    const a = await person('ada.l@x.test');
    const other = await createSession(db, a.user.id); // a second device

    expect(
      (
        await change(
          { currentPassword: 'wrong-password-1', newPassword: 'a brand new long passphrase' },
          a.headers,
        )
      ).status,
    ).toBe(400);
    const weak = await change({ currentPassword: PASSWORD, newPassword: 'short' }, a.headers);
    expect(weak.status).toBe(400);
    expect((await json(weak)).error.code).toBe('WEAK_PASSWORD');
    expect(
      (await change({ currentPassword: PASSWORD, newPassword: PASSWORD }, a.headers)).status,
    ).toBe(400);
    expect(await db.session.count({ where: { userId: a.user.id } })).toBe(2); // nothing changed yet

    const ok = await change(
      { currentPassword: PASSWORD, newPassword: 'a brand new long passphrase' },
      a.headers,
    );
    expect(ok.status).toBe(200);
    expect(await findSession(db, a.token)).not.toBeNull(); // this device stays signed in
    expect(await findSession(db, other.token)).toBeNull(); // the other one is gone

    const signIn = (password: string) =>
      handleSignIn(req('POST', '/s', { email: 'ada.l@x.test', password }), deps);
    expect((await signIn(PASSWORD)).status).toBe(401);
    expect((await signIn('a brand new long passphrase')).status).toBe(200);
    expect(await db.auditLog.count({ where: { action: 'user.password-change' } })).toBe(1);
  });

  it('is rate limited, so the current password cannot be guessed here', async () => {
    const a = await person('guess@x.test');
    for (let i = 0; i < 5; i++) {
      expect(
        (
          await change(
            { currentPassword: `wrong-guess-${i}-xx`, newPassword: 'a brand new long passphrase' },
            a.headers,
          )
        ).status,
      ).toBe(400);
    }
    const blocked = await change(
      { currentPassword: PASSWORD, newPassword: 'a brand new long passphrase' },
      a.headers,
    );
    expect(blocked.status).toBe(429);
  });
});

describe('deleting the account', () => {
  const del = (body: unknown, headers: Record<string, string>) =>
    call(deleteAccountRoute, req('DELETE', '/x', body, headers));

  it('needs the password, removes the person and everything they saved, keeps others, clears the cookie', async () => {
    await catalogue();
    const a = await person('gone@x.test');
    const b = await person('stays@x.test');
    await call(saveModelRoute, req('POST', '/x', { slug: 'acme-1' }, a.headers));
    await call(saveModelRoute, req('POST', '/x', { slug: 'acme-1' }, b.headers));
    await call(
      saveComparisonRoute,
      req('POST', '/x', { name: 'mine', models: ['acme-1', 'acme-2'] }, a.headers),
    );
    await call(recordViewRoute, req('POST', '/x', { slug: 'acme-1' }, a.headers));
    await call(
      putPreferencesRoute,
      req('PUT', '/x', { theme: 'dark', preferredProviders: [], personalized: true }, a.headers),
    );

    expect((await del({ password: 'not-my-password-1' }, a.headers)).status).toBe(400);
    expect(await db.user.count({ where: { email: 'gone@x.test' } })).toBe(1);

    const res = await del({ password: PASSWORD }, a.headers);
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect(await db.user.count({ where: { email: 'gone@x.test' } })).toBe(0);
    for (const t of [
      'session',
      'savedModel',
      'savedComparison',
      'recentlyViewed',
      'userPreference',
    ] as const) {
      expect(
        await (db[t] as { count: (a: object) => Promise<number> }).count({
          where: { userId: a.user.id },
        }),
        t,
      ).toBe(0);
    }
    expect(await db.savedModel.count({ where: { userId: b.user.id } })).toBe(1);
    expect(await findSession(db, a.token)).toBeNull();

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'user.delete-self' } });
    expect(audit).toMatchObject({ entityId: a.user.id, actorId: null });
    expect(audit.before).toMatchObject({ email: 'gone@x.test' });
  });

  it('the last administrator cannot delete themselves', async () => {
    const admin = await person('root@x.test', 'ADMIN');
    const res = await del({ password: PASSWORD }, admin.headers);
    expect(res.status).toBe(409);
    expect(await db.user.count({ where: { email: 'root@x.test' } })).toBe(1);
  });

  it('is rate limited like the password change', async () => {
    const a = await person('try@x.test');
    for (let i = 0; i < 5; i++)
      expect((await del({ password: `wrong-guess-${i}-xx` }, a.headers)).status).toBe(400);
    expect((await del({ password: PASSWORD }, a.headers)).status).toBe(429);
    expect(await db.user.count({ where: { email: 'try@x.test' } })).toBe(1);
  });
});
