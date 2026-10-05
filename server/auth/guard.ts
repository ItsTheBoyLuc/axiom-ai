import type { PrismaClient } from '../../prisma/generated/client';
import { checkSameOrigin } from '../../src/lib/auth/csrf';
import { ApiError, errorResponse, toErrorResponse } from '../api/http';
import { authorize } from './authorize';
import type { CookieConfig } from './cookie';
import { clientIp, type RateLimiter, type RateRule } from './rate-limit';
import type { Role, SessionUser } from './sessions';

/**
 * The one wrapper every session-bound API route goes through (/api/v1/admin/* and /api/v1/me/*),
 * so no route can forget a check:
 *   session -> required role (401 / 403, read from the database on every call) ->
 *   same-origin check on writes -> per-user rate limit -> handler -> uniform JSON, never cached.
 * Errors become the spec error envelope; unexpected ones are logged and not leaked.
 */

export type GuardDeps = {
  db: PrismaClient;
  limiter: RateLimiter;
  cookie: CookieConfig;
  allowedOrigins: string[];
  now?: () => Date;
};

export type GuardCtx<D extends GuardDeps> = {
  request: Request;
  user: SessionUser;
  deps: D;
  ip: string;
  /** Route params (already awaited). */
  params: Record<string, string>;
};

/** What a handler returns: plain data (sent as `{data}` with 200) or a ready Response. */
export type GuardResult = Response | { status?: number; data: unknown };

export const READ_RULE: RateRule = { limit: 600, windowSeconds: 60 };
export const WRITE_RULE: RateRule = { limit: 120, windowSeconds: 60 };

const SAFE_METHODS = new Set(['GET', 'HEAD']);

type RouteCtx = { params?: Promise<Record<string, string>> | Record<string, string> };

export function guardedRoute<D extends GuardDeps>(
  required: Role,
  run: (ctx: GuardCtx<D>) => Promise<GuardResult>,
  deps: () => D,
  opts: { rule?: RateRule; bucket: string },
) {
  return async function handle(request: Request, routeCtx?: RouteCtx): Promise<Response> {
    try {
      const d = deps();
      const write = !SAFE_METHODS.has(request.method.toUpperCase());

      // Authenticate first: anonymous callers learn nothing else about the route.
      const user = await authorize(d.db, d.cookie, request, required, d.now?.());

      if (write && !checkSameOrigin(request, d.allowedOrigins).ok) {
        throw new ApiError(403, 'CROSS_ORIGIN', 'This request was refused.');
      }
      const rule = opts.rule ?? (write ? WRITE_RULE : READ_RULE);
      const verdict = await d.limiter.hit(`${opts.bucket}:${write ? 'w' : 'r'}:${user.id}`, rule);
      if (!verdict.allowed) {
        return errorResponse(
          429,
          'RATE_LIMITED',
          'Too many requests. Try again shortly.',
          undefined,
          { 'Retry-After': String(verdict.retryAfterSeconds) },
        );
      }

      const params = (await routeCtx?.params) ?? {};
      const result = await run({ request, user, deps: d, ip: clientIp(request), params });
      if (result instanceof Response) return result;
      return new Response(JSON.stringify({ data: result.data }), {
        status: result.status ?? 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export type { PrismaClient };
