import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy (Next.js 16's middleware): an OPTIMISTIC check only. A request to /admin without any
 * session cookie is sent to sign-in right away, without touching the database. It is not a
 * security boundary: every admin page and every admin API verifies the session against the
 * database itself (server/auth), because a cookie's presence proves nothing.
 */
export function proxy(request: NextRequest) {
  const hasCookie =
    request.cookies.has('axiom_session') || request.cookies.has('__Host-axiom_session');
  if (!hasCookie) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = '/sign-in';
    url.search = `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
