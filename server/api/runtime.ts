import { z } from 'zod';
import { getCache, type Cache, type CacheStatus } from '../cache/cache';
import { clientIp, getRateLimiter, type RateLimiter, type RateRule } from '../auth/rate-limit';
import { getRepositories, type Repositories } from '../repositories';
import type { Endpoint } from './endpoints';
import { cachedResponse, errorResponse, parseParams, parseQuery, toErrorResponse } from './http';

export type Runtime = {
  repos: Repositories;
  cache: Cache | null;
  /** Per-address limiter for the public API. Absent = unlimited (unit tests only). */
  limiter?: RateLimiter | null;
};

/**
 * Public read API budget per client address. The site itself reads through the repositories, not
 * this API, so this only meters external callers and the browser's search-as-you-type. Override
 * with API_RATE_LIMIT_PER_MINUTE (0 disables, e.g. for load tests).
 */
export function apiRule(env: NodeJS.ProcessEnv = process.env): RateRule | null {
  const raw = env.API_RATE_LIMIT_PER_MINUTE;
  const limit = raw === undefined || raw === '' ? 240 : Number(raw);
  if (!Number.isFinite(limit) || limit <= 0) return null;
  return { limit: Math.floor(limit), windowSeconds: 60 };
}

/** Production wiring: shared Prisma repositories, the Redis cache and limiter from REDIS_URL. */
export const defaultRuntime = (): Runtime => ({
  repos: getRepositories(),
  cache: getCache(),
  limiter: getRateLimiter(),
});

const noQuery = z.strictObject({});

type RouteCtx = { params?: Promise<Record<string, string>> | Record<string, string> };

/**
 * Turns an endpoint definition into a Next.js route handler:
 *   validate params + query (strict) -> Redis read-through cache -> ETag/304 + Cache-Control.
 * Every failure becomes the spec error envelope; unexpected errors are logged, never leaked.
 */
export function createHandler(endpoint: Endpoint, runtime: () => Runtime = defaultRuntime) {
  return async function handle(request: Request, routeCtx?: RouteCtx): Promise<Response> {
    try {
      if (!endpoint.handler) throw new Error(`endpoint ${endpoint.id} has no handler`);
      const rt = runtime();
      const rule = apiRule();
      let limitHeaders: Record<string, string> = {};
      if (rt.limiter && rule) {
        const verdict = await rt.limiter.hit(`api:${clientIp(request)}`, rule);
        limitHeaders = {
          'RateLimit-Limit': String(rule.limit),
          'RateLimit-Remaining': String(verdict.remaining),
          'RateLimit-Reset': String(verdict.retryAfterSeconds),
        };
        if (!verdict.allowed) {
          return errorResponse(
            429,
            'RATE_LIMITED',
            'Too many requests. Try again shortly.',
            undefined,
            {
              ...limitHeaders,
              'Retry-After': String(verdict.retryAfterSeconds),
            },
          );
        }
      }
      const url = new URL(request.url);
      const params = endpoint.params
        ? parseParams(endpoint.params, await routeCtx?.params)
        : undefined;
      const query = parseQuery(endpoint.query ?? noQuery, url);
      const run = () => endpoint.handler!({ query, params, repos: rt.repos, request });

      let body: unknown;
      let status: CacheStatus = 'BYPASS';
      if (endpoint.cache && rt.cache) {
        // Key on the PARSED values so `?page=1` and no page share an entry.
        const key = `${endpoint.id}:${JSON.stringify({ q: query, p: params })}`;
        const r = await rt.cache.wrap(
          key,
          { ttlSeconds: endpoint.cache.ttlSeconds, tags: endpoint.cache.tags({ query, params }) },
          run,
        );
        body = r.value;
        status = r.status;
      } else {
        body = await run();
      }

      return cachedResponse(request, body, {
        policy: endpoint.policy,
        contentType: endpoint.contentType,
        headers: { 'X-Cache': status, ...limitHeaders, ...endpoint.headers?.({ query, params }) },
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
