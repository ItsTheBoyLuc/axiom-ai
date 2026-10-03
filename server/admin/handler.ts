import { checkSameOrigin } from '../../src/lib/auth/csrf';
import { ApiError, errorResponse, toErrorResponse } from '../api/http';
import type { PrismaClient } from '../../prisma/generated/client';
import { authorize } from '../auth/authorize';
import type { CookieConfig } from '../auth/cookie';
import type { SyncJob, WorkerStatus } from '../jobs/queue';
import { clientIp, type RateLimiter, type RateRule } from '../auth/rate-limit';
import type { SessionUser } from '../auth/sessions';

/**
 * The one wrapper every /api/v1/admin route goes through, so no route can forget a check:
 *   session -> ADMIN role (401 / 403, from the database) -> same-origin check on writes ->
 *   per-admin rate limit -> handler -> uniform JSON, never cached.
 * Errors become the spec error envelope; unexpected ones are logged and not leaked.
 */

export type AdminDeps = {
  db: PrismaClient;
  limiter: RateLimiter;
  cookie: CookieConfig;
  allowedOrigins: string[];
  /** Makes cached reads stale after a write (cache tags, see server/admin/definitions.ts). */
  invalidate: (tags: string[]) => Promise<void>;
  /** Queues a sync run for the worker ("Run now"). Throws ApiError 503 when the queue is down. */
  enqueueSync: (job: SyncJob) => Promise<void>;
  /** Whether a worker has reported in recently (dashboard). */
  workerStatus: () => Promise<WorkerStatus>;
  now?: () => Date;
};

export type AdminCtx = {
  request: Request;
  user: SessionUser;
  deps: AdminDeps;
  ip: string;
  /** Route params (already awaited). */
  params: Record<string, string>;
};

/** What a handler returns: plain data (sent as `{data}` with 200) or a ready Response. */
export type AdminResult = Response | { status?: number; data: unknown };

export const READ_RULE: RateRule = { limit: 600, windowSeconds: 60 };
export const WRITE_RULE: RateRule = { limit: 120, windowSeconds: 60 };

const SAFE_METHODS = new Set(['GET', 'HEAD']);

type RouteCtx = { params?: Promise<Record<string, string>> | Record<string, string> };

export function adminRoute(
  run: (ctx: AdminCtx) => Promise<AdminResult>,
  deps: () => AdminDeps,
  opts: { rule?: RateRule } = {},
) {
  return async function handle(request: Request, routeCtx?: RouteCtx): Promise<Response> {
    try {
      const d = deps();
      const write = !SAFE_METHODS.has(request.method.toUpperCase());

      // Authenticate first: anonymous callers learn nothing else about the route.
      const user = await authorize(d.db, d.cookie, request, 'ADMIN', d.now?.());

      if (write && !checkSameOrigin(request, d.allowedOrigins).ok) {
        throw new ApiError(403, 'CROSS_ORIGIN', 'This request was refused.');
      }
      const rule = opts.rule ?? (write ? WRITE_RULE : READ_RULE);
      const verdict = await d.limiter.hit(`admin:${write ? 'w' : 'r'}:${user.id}`, rule);
      if (!verdict.allowed) {
        return errorResponse(
          429,
          'RATE_LIMITED',
          'Too many requests. Try again shortly.',
          undefined,
          {
            'Retry-After': String(verdict.retryAfterSeconds),
          },
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
