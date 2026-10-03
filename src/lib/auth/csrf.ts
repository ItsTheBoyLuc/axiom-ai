/**
 * CSRF defence for cookie-authenticated, state-changing requests (docs/PROMPT.md 12).
 *
 * The session cookie is SameSite=Lax, which already stops cross-site POSTs in current browsers;
 * this adds the second, independent layer recommended for defence in depth: a request that
 * changes state must come from our own origin. The browser sends `Origin` on every cross-origin
 * and on every same-origin POST/PUT/PATCH/DELETE, and `Sec-Fetch-Site` on all modern browsers.
 * A request with neither header (a script, curl) is only accepted when it presents no cookie, i.e.
 * it cannot be riding a victim's session.
 */

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type CsrfVerdict = { ok: true } | { ok: false; reason: string };

export function checkSameOrigin(
  request: { method: string; headers: Pick<Headers, 'get'>; url: string },
  allowedOrigins: string[] = [],
): CsrfVerdict {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return { ok: true };

  const allowed = new Set([new URL(request.url).origin, ...allowedOrigins.map(originOf)]);
  const origin = request.headers.get('origin');
  if (origin) {
    return allowed.has(origin)
      ? { ok: true }
      : { ok: false, reason: 'cross-origin request refused' };
  }

  const site = request.headers.get('sec-fetch-site');
  if (site) {
    return site === 'same-origin' || site === 'none'
      ? { ok: true }
      : { ok: false, reason: 'cross-site request refused' };
  }

  // No Origin and no Fetch Metadata: not a browser form or fetch. Safe only without a cookie.
  return request.headers.get('cookie')
    ? { ok: false, reason: 'missing origin on a cookie-authenticated request' }
    : { ok: true };
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
