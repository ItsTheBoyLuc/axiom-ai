import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  passwordIssues,
  safeNextPath,
  signInSchema,
} from '@/lib/auth/credentials';
import { checkSameOrigin } from '@/lib/auth/csrf';
import { redact } from '../../server/audit';
import { readJson } from '../../server/api/body';
import { ApiError } from '../../server/api/http';
import {
  clearSessionCookie,
  cookieConfig,
  readCookie,
  sessionSetCookie,
} from '../../server/auth/cookie';
import { hashToken, newSessionToken, randomPassword, safeEqual } from '../../server/auth/crypto';
import {
  hashPassword,
  needsRehash,
  spendHashTime,
  verifyPassword,
} from '../../server/auth/password';
import {
  clientIp,
  createMemoryLimiter,
  createRedisLimiter,
  type RateLimiter,
} from '../../server/auth/rate-limit';

describe('credentials', () => {
  it('normalises emails to lower case without surrounding space', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it('accepts a normal sign-in and normalises the email', () => {
    const r = signInSchema.parse({ email: ' Ada@Example.com ', password: 'x' });
    expect(r.email).toBe('ada@example.com');
  });

  it('rejects bad emails, empty or oversized passwords and unknown fields', () => {
    expect(signInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    expect(
      signInSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(MAX_PASSWORD_LENGTH + 1) })
        .success,
    ).toBe(false);
    expect(signInSchema.safeParse({ email: 'a@b.co', password: 'x', role: 'ADMIN' }).success).toBe(
      false,
    );
    expect(
      signInSchema.safeParse({ email: `${'a'.repeat(250)}@b.co`, password: 'x' }).success,
    ).toBe(false);
  });

  it('never trims or alters the password', () => {
    expect(signInSchema.parse({ email: 'a@b.co', password: '  spaced  ' }).password).toBe(
      '  spaced  ',
    );
  });
});

describe('password policy', () => {
  it('accepts a long passphrase', () => {
    expect(passwordIssues('correct horse battery staple')).toEqual([]);
  });
  it('flags short, long, common, repetitive and email-derived passwords', () => {
    expect(passwordIssues('short')).toContain('too-short');
    expect(passwordIssues('x'.repeat(MAX_PASSWORD_LENGTH + 1))).toContain('too-long');
    expect(passwordIssues('Password1234')).toContain('common');
    expect(passwordIssues('aaaaaaaaaaaaaaaa')).toContain('repetitive');
    expect(passwordIssues('my-lucas-secret-phrase', 'Lucas@example.com')).toContain(
      'contains-email',
    );
    expect(passwordIssues('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toContain('too-short');
  });
});

describe('safeNextPath (no open redirects)', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/models?page=2#top', '/admin/models?page=2#top'],
    ['/', '/'],
  ])('keeps the same-site path %s', (raw, out) => {
    expect(safeNextPath(raw)).toBe(out);
  });

  it.each([
    'https://evil.example/',
    '//evil.example/path',
    '/\\evil.example',
    'javascript:alert(1)',
    '/%0d%0aSet-Cookie:x=1',
    '/ok\r\nLocation: https://evil.example',
    'admin',
    '',
  ])('refuses %j', (raw) => {
    expect(safeNextPath(raw, '/fallback')).toBe('/fallback');
  });

  it('uses the fallback for missing input', () => {
    expect(safeNextPath(undefined, '/admin')).toBe('/admin');
    expect(safeNextPath(null)).toBe('/');
  });
});

describe('checkSameOrigin (CSRF)', () => {
  const req = (method: string, headers: Record<string, string> = {}) => ({
    method,
    url: 'https://axiom.example/api/v1/admin/models',
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  });

  it('never blocks safe methods', () => {
    expect(checkSameOrigin(req('GET', { origin: 'https://evil.example' })).ok).toBe(true);
    expect(checkSameOrigin(req('HEAD')).ok).toBe(true);
  });

  it('accepts a same-origin Origin header and rejects any other', () => {
    expect(checkSameOrigin(req('POST', { origin: 'https://axiom.example' })).ok).toBe(true);
    expect(checkSameOrigin(req('POST', { origin: 'https://evil.example' })).ok).toBe(false);
    expect(checkSameOrigin(req('DELETE', { origin: 'null' })).ok).toBe(false);
  });

  it('accepts configured extra origins (the public APP_URL behind a proxy)', () => {
    const r = req('PUT', { origin: 'https://www.axiom.example' });
    expect(checkSameOrigin(r).ok).toBe(false);
    expect(checkSameOrigin(r, ['https://www.axiom.example/']).ok).toBe(true);
  });

  it('falls back to Fetch Metadata when there is no Origin', () => {
    expect(checkSameOrigin(req('POST', { 'sec-fetch-site': 'same-origin' })).ok).toBe(true);
    expect(checkSameOrigin(req('POST', { 'sec-fetch-site': 'none' })).ok).toBe(true);
    expect(checkSameOrigin(req('POST', { 'sec-fetch-site': 'cross-site' })).ok).toBe(false);
    expect(checkSameOrigin(req('POST', { 'sec-fetch-site': 'same-site' })).ok).toBe(false);
  });

  it('with no browser signals, only accepts requests that carry no cookie', () => {
    expect(checkSameOrigin(req('POST')).ok).toBe(true);
    expect(checkSameOrigin(req('POST', { cookie: 'axiom_session=abc' })).ok).toBe(false);
  });
});

describe('session cookie', () => {
  it('uses the __Host- prefix and Secure over HTTPS, a plain name over HTTP', () => {
    expect(cookieConfig('https://axiom.example')).toEqual({
      name: '__Host-axiom_session',
      secure: true,
    });
    expect(cookieConfig('http://localhost:3000')).toEqual({ name: 'axiom_session', secure: false });
  });

  it('sets HttpOnly, SameSite=Lax, Path=/ and an expiry (Secure when HTTPS)', () => {
    const exp = new Date('2026-10-10T00:00:00Z');
    const https = sessionSetCookie(cookieConfig('https://a.example'), 'tok', exp);
    expect(https).toContain('__Host-axiom_session=tok');
    for (const part of [
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Secure',
      'Expires=Sat, 10 Oct 2026',
    ]) {
      expect(https).toContain(part);
    }
    expect(https).not.toContain('Domain');
    expect(sessionSetCookie(cookieConfig('http://localhost'), 'tok', exp)).not.toContain('Secure');
  });

  it('clears the cookie with an expired date and Max-Age=0', () => {
    const c = clearSessionCookie(cookieConfig('http://localhost'));
    expect(c).toContain('axiom_session=;');
    expect(c).toContain('Max-Age=0');
    expect(c).toContain('1970');
  });

  it('reads one cookie out of a header', () => {
    expect(readCookie('a=1; axiom_session=tok; b=2', 'axiom_session')).toBe('tok');
    expect(readCookie('a=1', 'axiom_session')).toBeUndefined();
    expect(readCookie(null, 'x')).toBeUndefined();
    expect(readCookie('axiom_session', 'axiom_session')).toBeUndefined();
  });
});

describe('crypto helpers', () => {
  it('creates long, unique, URL-safe session tokens', () => {
    const a = newSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newSessionToken()).not.toBe(a);
  });

  it('stores only a stable SHA-256 of the token', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
    expect(hashToken('abc')).not.toContain('abc');
  });

  it('compares in constant time, including different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('generates random passwords from an unambiguous alphabet that pass the policy', () => {
    const p = randomPassword();
    expect(p).toHaveLength(24);
    expect(p).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]+$/);
    expect(randomPassword()).not.toBe(p);
    expect(passwordIssues(p)).toEqual([]);
  });
});

describe('password hashing (Argon2id)', () => {
  it('hashes with Argon2id and verifies only the right password', async () => {
    const h = await hashPassword('correct horse battery');
    expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(h, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(h, 'wrong horse battery')).toBe(false);
  });

  it('salts every hash differently', async () => {
    expect(await hashPassword('same-password-here')).not.toBe(
      await hashPassword('same-password-here'),
    );
  });

  it('treats a malformed stored hash as a failed check, never an exception', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
    expect(await verifyPassword('', 'x')).toBe(false);
  });

  it('flags hashes made with weaker parameters (or another algorithm) for an upgrade', () => {
    expect(needsRehash('$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA')).toBe(false);
    expect(needsRehash('$argon2id$v=19$m=4096,t=1,p=1$c2FsdA$aGFzaA')).toBe(true);
    expect(needsRehash('$argon2i$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA')).toBe(true);
    expect(needsRehash('$2b$10$abc')).toBe(true);
  });

  it('spends hashing time for an unknown account without throwing', async () => {
    await expect(spendHashTime('anything')).resolves.toBeUndefined();
  });
});

describe('rate limiting', () => {
  it('allows up to the limit per window, then refuses with a retry delay', async () => {
    let t = 1_000_000;
    const lim = createMemoryLimiter(() => t);
    const rule = { limit: 3, windowSeconds: 60 };
    const r = [await lim.hit('k', rule), await lim.hit('k', rule), await lim.hit('k', rule)];
    expect(r.map((x) => x.allowed)).toEqual([true, true, true]);
    expect(r[2]!.remaining).toBe(0);
    const blocked = await lim.hit('k', rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('counts keys independently and starts a new window after the old one ends', async () => {
    let t = 0;
    const lim = createMemoryLimiter(() => t);
    const rule = { limit: 1, windowSeconds: 10 };
    expect((await lim.hit('a', rule)).allowed).toBe(true);
    expect((await lim.hit('a', rule)).allowed).toBe(false);
    expect((await lim.hit('b', rule)).allowed).toBe(true);
    t += 10_001;
    expect((await lim.hit('a', rule)).allowed).toBe(true);
  });

  it('shares counts through Redis and sets an expiry on the first hit only', async () => {
    const store = new Map<string, number>();
    const expire = vi.fn(async () => 1);
    const redis = {
      incr: vi.fn(async (k: string) => store.set(k, (store.get(k) ?? 0) + 1).get(k)!),
      expire,
      pttl: vi.fn(async () => 42_000),
    };
    const lim = createRedisLimiter(redis, createMemoryLimiter());
    const rule = { limit: 2, windowSeconds: 60 };
    expect((await lim.hit('k', rule)).allowed).toBe(true);
    expect((await lim.hit('k', rule)).allowed).toBe(true);
    const third = await lim.hit('k', rule);
    expect(third).toMatchObject({ allowed: false, retryAfterSeconds: 42 });
    expect(expire).toHaveBeenCalledTimes(1);
  });

  it('falls back to the in-memory limiter when Redis fails (it never fails open)', async () => {
    const redis = {
      incr: vi.fn(async () => {
        throw new Error('down');
      }),
      expire: vi.fn(),
      pttl: vi.fn(),
    };
    const fallback: RateLimiter = createMemoryLimiter();
    const lim = createRedisLimiter(redis as never, fallback);
    const rule = { limit: 1, windowSeconds: 60 };
    expect((await lim.hit('k', rule)).allowed).toBe(true);
    expect((await lim.hit('k', rule)).allowed).toBe(false);
  });

  it('takes the caller address from the first forwarded hop', () => {
    const h = (v: Record<string, string>) => ({
      headers: { get: (n: string) => v[n.toLowerCase()] ?? null },
    });
    expect(clientIp(h({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
    expect(clientIp(h({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIp(h({}))).toBe('unknown');
  });
});

describe('audit redaction', () => {
  it('replaces secrets at any depth and keeps everything else', () => {
    const out = redact({
      email: 'a@b.co',
      passwordHash: '$argon2id$...',
      nested: { sessionToken: 'abc', ok: 1, list: [{ token: 't', name: 'n' }] },
    }) as Record<string, unknown>;
    expect(out.passwordHash).toBe('[redacted]');
    expect(out.email).toBe('a@b.co');
    expect(JSON.stringify(out)).not.toContain('argon2id');
    expect(JSON.stringify(out)).not.toContain('"abc"');
    expect((out.nested as { ok: number }).ok).toBe(1);
    expect(JSON.stringify(out)).toContain('"name":"n"');
  });

  it('makes values JSON-safe: dates, decimals and bigints', () => {
    const out = redact({
      d: new Date('2026-01-02T03:04:05Z'),
      price: { toNumber: () => 1.25 },
      n: BigInt(7),
      nothing: null,
      u: undefined,
    }) as Record<string, unknown>;
    expect(out).toEqual({
      d: '2026-01-02T03:04:05.000Z',
      price: 1.25,
      n: '7',
      nothing: null,
      u: null,
    });
    expect(() => JSON.stringify(out)).not.toThrow();
  });
});

describe('readJson', () => {
  const schema = z.strictObject({ name: z.string().min(1) });
  const post = (
    body: BodyInit,
    headers: Record<string, string> = { 'content-type': 'application/json' },
  ) => new Request('http://x.test/api', { method: 'POST', headers, body });

  it('returns the validated body', async () => {
    expect(await readJson(post('{"name":"a"}'), schema)).toEqual({ name: 'a' });
    expect(
      await readJson(
        post('{"name":"a"}', { 'content-type': 'application/json; charset=utf-8' }),
        schema,
      ),
    ).toEqual({ name: 'a' });
  });

  it('refuses another content type (415), bad JSON and invalid fields (400, with details)', async () => {
    await expect(
      readJson(post('{"name":"a"}', { 'content-type': 'text/plain' }), schema),
    ).rejects.toMatchObject({ status: 415 });
    await expect(readJson(post('{nope'), schema)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_BODY',
    });
    const err = (await readJson(post('{"name":""}'), schema).catch((e) => e)) as ApiError;
    expect(err.status).toBe(400);
    expect(err.details).toEqual([{ path: 'name', message: expect.any(String) }]);
    await expect(readJson(post('{"name":"a","extra":1}'), schema)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('refuses an oversized body (413), even when Content-Length is missing or false', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(2000) });
    await expect(readJson(post(big), schema, 1000)).rejects.toMatchObject({ status: 413 });
    await expect(
      readJson(
        post(big, { 'content-type': 'application/json', 'content-length': '5' }),
        schema,
        1000,
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
});
