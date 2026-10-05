import type { PrismaClient } from '../../prisma/generated/client';
import { getPreferences, savedSlugs } from '../account/service';
import { signUpSchema } from '../../src/lib/account/schemas';
import { checkSameOrigin } from '../../src/lib/auth/csrf';
import { safeNextPath, signInSchema } from '../../src/lib/auth/credentials';
import { readJson } from '../api/body';
import { ApiError, errorResponse, toErrorResponse } from '../api/http';
import { userFromRequest } from './authorize';
import { clearSessionCookie, readCookie, sessionSetCookie, type CookieConfig } from './cookie';
import { clientIp, type RateLimiter } from './rate-limit';
import { signIn } from './service';
import { signUp } from './signup';
import { deleteSession } from './sessions';

export type AuthDeps = {
  db: PrismaClient;
  limiter: RateLimiter;
  cookie: CookieConfig;
  /** Origins (besides the request's own) that may submit state-changing requests. */
  allowedOrigins: string[];
  now?: () => Date;
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });

function requireSameOrigin(request: Request, deps: AuthDeps) {
  const verdict = checkSameOrigin(request, deps.allowedOrigins);
  if (!verdict.ok) throw new ApiError(403, 'CROSS_ORIGIN', 'This request was refused.');
}

/**
 * POST /api/v1/auth/sign-in. Same-origin only, body validated, throttled per address and per
 * account, and one uniform 401 for every kind of wrong credential. On success the session cookie
 * is set and the (safe) place to go next is returned.
 */
export async function handleSignIn(request: Request, deps: AuthDeps): Promise<Response> {
  try {
    requireSameOrigin(request, deps);
    const input = await readJson(request, signInSchema);
    const result = await signIn(
      { db: deps.db, limiter: deps.limiter, now: deps.now },
      { email: input.email, password: input.password, ip: clientIp(request) },
    );
    if (!result.ok) {
      if (result.reason === 'throttled') {
        return errorResponse(
          429,
          'RATE_LIMITED',
          'Too many attempts. Try again later.',
          undefined,
          {
            'Retry-After': String(result.retryAfterSeconds),
          },
        );
      }
      return errorResponse(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');
    }
    const fallback = result.user.role === 'ADMIN' ? '/admin' : '/';
    return json(
      200,
      { data: { user: result.user, next: safeNextPath(input.next, fallback) } },
      { 'Set-Cookie': sessionSetCookie(deps.cookie, result.token, result.expires) },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** POST /api/v1/auth/sign-out: revokes the session server-side and clears the cookie. */
export async function handleSignOut(request: Request, deps: AuthDeps): Promise<Response> {
  try {
    requireSameOrigin(request, deps);
    await deleteSession(deps.db, readCookie(request.headers.get('cookie'), deps.cookie.name));
    return json(200, { data: { ok: true } }, { 'Set-Cookie': clearSessionCookie(deps.cookie) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** GET /api/v1/auth/me: who am I (401 when signed out). Never cached. */
export async function handleMe(request: Request, deps: AuthDeps): Promise<Response> {
  try {
    const user = await userFromRequest(deps.db, deps.cookie, request, deps.now?.());
    if (!user) return errorResponse(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    return json(200, { data: { user } });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/v1/auth/sign-up. Same-origin only, body validated, throttled per address, password
 * policy enforced on the server. On success the account exists, a session cookie is set and the
 * (safe) place to go next is returned. Always a USER: nobody becomes an admin by signing up.
 */
export async function handleSignUp(request: Request, deps: AuthDeps): Promise<Response> {
  try {
    requireSameOrigin(request, deps);
    const input = await readJson(request, signUpSchema);
    const result = await signUp(
      { db: deps.db, limiter: deps.limiter, now: deps.now },
      { email: input.email, password: input.password, name: input.name, ip: clientIp(request) },
    );
    if (!result.ok) {
      return errorResponse(
        429,
        'RATE_LIMITED',
        'Too many sign-ups from this address. Try again later.',
        undefined,
        {
          'Retry-After': String(result.retryAfterSeconds),
        },
      );
    }
    return json(
      201,
      { data: { user: result.user, next: safeNextPath(input.next, '/account') } },
      { 'Set-Cookie': sessionSetCookie(deps.cookie, result.token, result.expires) },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * GET /api/v1/auth/session: the page chrome's "who am I". Unlike /me it answers 200 with
 * `user: null` when nobody is signed in (so anonymous page views produce no failed requests in
 * the browser console), and does no database work at all when there is no session cookie.
 */
export async function handleSession(request: Request, deps: AuthDeps): Promise<Response> {
  try {
    if (!readCookie(request.headers.get('cookie'), deps.cookie.name)) {
      return json(200, { data: { user: null, preferences: null, savedModels: null } });
    }
    const user = await userFromRequest(deps.db, deps.cookie, request, deps.now?.());
    if (!user) return json(200, { data: { user: null, preferences: null, savedModels: null } });
    const [preferences, savedModels] = await Promise.all([
      getPreferences(deps.db, user.id),
      savedSlugs(deps.db, user.id),
    ]);
    return json(200, { data: { user, preferences, savedModels } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
