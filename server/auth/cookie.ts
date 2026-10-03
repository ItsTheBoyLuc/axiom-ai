/**
 * The session cookie (docs/PROMPT.md 12: secure httpOnly session cookies). Pure string handling so
 * it can be tested without Next.js.
 *
 * - `HttpOnly`: scripts (and so XSS) cannot read it.
 * - `SameSite=Lax`: not sent on cross-site POSTs; first line of CSRF defence (see lib/auth/csrf).
 * - `Secure` and the `__Host-` prefix over HTTPS: the browser then also refuses a cookie set by a
 *   subdomain or over plain HTTP, and pins it to `Path=/` with no `Domain`.
 */

export type CookieConfig = { name: string; secure: boolean };

export function cookieConfig(appUrl: string): CookieConfig {
  const secure = appUrl.startsWith('https://');
  return { name: secure ? '__Host-axiom_session' : 'axiom_session', secure };
}

/** The value of one cookie from a `Cookie` header, or undefined. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

export function sessionSetCookie(cfg: CookieConfig, token: string, expires: Date): string {
  return [
    `${cfg.name}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expires.toUTCString()}`,
    ...(cfg.secure ? ['Secure'] : []),
  ].join('; ');
}

export function clearSessionCookie(cfg: CookieConfig): string {
  return [
    `${cfg.name}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
    ...(cfg.secure ? ['Secure'] : []),
  ].join('; ');
}
