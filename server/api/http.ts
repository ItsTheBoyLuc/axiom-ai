import { createHash } from 'node:crypto';
import { z } from 'zod';

/** HTTP helpers shared by every /api/v1 route: error envelope, ETag/304, Cache-Control. */

export type ErrorBody = { error: { code: string; message: string; details?: unknown } };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', `${what} not found`);

/** Spec error envelope: { error: { code, message, details? } }. Never cached. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ErrorBody = {
    error: { code, message, ...(details === undefined ? {} : { details }) },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Strong ETag derived from the serialised body. */
export function etagOf(body: string): string {
  return `"${createHash('sha1').update(body).digest('base64url')}"`;
}

/** Does an If-None-Match header match this ETag (handles lists, weak validators and *)? */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;
  const bare = (t: string) => t.trim().replace(/^W\//, '');
  return header.split(',').some((t) => bare(t) === etag);
}

export type CachePolicy = {
  /** Shared-cache (CDN) freshness in seconds. */
  maxAge: number;
  /** stale-while-revalidate window in seconds. */
  swr: number;
};

/**
 * 200 (or 304) response with ETag and Cache-Control. `body` may be an object (JSON) or a
 * pre-rendered string with an explicit content type (CSV).
 */
export function cachedResponse(
  request: Request,
  body: unknown,
  opts: {
    policy: CachePolicy | 'no-store';
    contentType?: string;
    headers?: Record<string, string>;
  },
): Response {
  const isString = typeof body === 'string';
  const text = isString ? body : JSON.stringify(body);
  const etag = etagOf(text);
  const headers: Record<string, string> = {
    'Content-Type': opts.contentType ?? 'application/json; charset=utf-8',
    ETag: etag,
    'Cache-Control':
      opts.policy === 'no-store'
        ? 'no-store'
        : `public, s-maxage=${opts.policy.maxAge}, stale-while-revalidate=${opts.policy.swr}`,
    Vary: 'Accept-Encoding',
    ...opts.headers,
  };
  if (etagMatches(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(text, { status: 200, headers });
}

/** Zod issues in a compact, client-friendly shape. */
export function zodDetails(error: z.ZodError) {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/**
 * Parses a URL's query string with a strict schema. Unknown parameters are rejected (a typo
 * such as `categroy=coding` must not silently return unfiltered data).
 */
export function parseQuery<T>(schema: z.ZodType<T>, url: URL): T {
  const seen = new Map<string, string>();
  for (const [k, v] of url.searchParams) {
    if (!seen.has(k)) seen.set(k, v); // first value wins; repeated keys are ignored
  }
  const parsed = schema.safeParse(Object.fromEntries(seen));
  if (!parsed.success)
    throw new ApiError(400, 'INVALID_QUERY', 'Invalid query parameters', zodDetails(parsed.error));
  return parsed.data;
}

export function parseParams<T>(schema: z.ZodType<T>, params: unknown): T {
  const parsed = schema.safeParse(params);
  if (!parsed.success)
    throw new ApiError(400, 'INVALID_PARAMS', 'Invalid path parameters', zodDetails(parsed.error));
  return parsed.data;
}

/** Turns any thrown value into the spec error envelope. Unknown errors are logged, never leaked. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message, err.details);
  console.error('[api] unhandled error', err);
  return errorResponse(500, 'INTERNAL_ERROR', 'Something went wrong');
}
