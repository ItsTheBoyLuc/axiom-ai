import { z } from 'zod';
import { getCache, type Cache, type CacheStatus } from '../cache/cache';
import { getRepositories, type Repositories } from '../repositories';
import type { Endpoint } from './endpoints';
import { cachedResponse, parseParams, parseQuery, toErrorResponse } from './http';

export type Runtime = { repos: Repositories; cache: Cache | null };

/** Production wiring: shared Prisma repositories and the Redis cache from REDIS_URL. */
export const defaultRuntime = (): Runtime => ({ repos: getRepositories(), cache: getCache() });

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
      const url = new URL(request.url);
      const params = endpoint.params
        ? parseParams(endpoint.params, await routeCtx?.params)
        : undefined;
      const query = parseQuery(endpoint.query ?? noQuery, url);
      const rt = runtime();
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
        headers: { 'X-Cache': status, ...endpoint.headers?.({ query, params }) },
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
