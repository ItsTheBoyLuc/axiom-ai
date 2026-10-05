import { NextResponse, type NextRequest } from 'next/server';
import { buildCsp, HSTS_VALUE, newNonce } from '@/lib/security/csp';

/**
 * Proxy (Next.js 16's middleware). Two jobs:
 *
 * 1. Per-request security headers: a nonce-based Content-Security-Policy (the nonce is also
 *    passed to the render in `x-nonce`, see app/layout.tsx) and HSTS over HTTPS.
 * 2. An OPTIMISTIC sign-in redirect for /admin, /account and /settings: without any session cookie
 *    the visitor goes to sign-in right away, without touching the database. It is not a security
 *    boundary: every protected page and API verifies the session against the database itself
 *    (server/auth), because a cookie's presence proves nothing.
 */

const API_CSP = "default-src 'none'; frame-ancestors 'none'";
const PROTECTED = /^\/(admin|account|settings)(\/|$)/;

const isHttps = (request: NextRequest) =>
  request.headers.get('x-forwarded-proto') === 'https' ||
  request.nextUrl.protocol === 'https:' ||
  (process.env.APP_URL ?? '').startsWith('https://');

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PROTECTED.test(pathname)) {
    const hasCookie =
      request.cookies.has('axiom_session') || request.cookies.has('__Host-axiom_session');
    if (!hasCookie) {
      const url = request.nextUrl.clone();
      url.pathname = '/sign-in';
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  const https = isHttps(request);

  // API responses are data, never documents: nothing may load from them. (/api/docs is the one
  // hand-written HTML page and sets its own policy in its route.)
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    if (pathname !== '/api/docs') {
      response.headers.set('Content-Security-Policy', API_CSP);
    }
    if (https) response.headers.set('Strict-Transport-Security', HSTS_VALUE);
    return response;
  }

  const nonce = newNonce();
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === 'development', https });

  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  if (https) response.headers.set('Strict-Transport-Security', HSTS_VALUE);
  return response;
}

export const config = {
  // Pages and API; static build output and metadata files need neither.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt).*)'],
};
