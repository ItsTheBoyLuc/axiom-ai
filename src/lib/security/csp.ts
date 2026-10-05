/**
 * Content Security Policy and HSTS (docs/PROMPT.md 12), built per request by `src/proxy.ts`.
 * Pure functions so the policy is unit-tested without Next.js.
 *
 * - Scripts: only same-origin files and scripts carrying this request's nonce (`strict-dynamic`
 *   lets those load their own chunks). No `unsafe-inline`, no `unsafe-eval` in production.
 * - Styles: same-origin sheets and nonce'd <style> tags. `style-src-attr 'unsafe-inline'` is the one
 *   concession: React renders `style="..."` attributes (chart geometry, CSS variables), which cannot
 *   carry a nonce. Attribute styles cannot run script, so the risk is limited to CSS-based tricks.
 * - Everything else is locked to same-origin: no framing (`frame-ancestors`), no plugins, no
 *   `<base>` hijack, forms post to ourselves only.
 */

export type CspOptions = {
  nonce: string;
  /** `next dev` needs `unsafe-eval` (React debugging) and inline styles (HMR). Never in production. */
  dev?: boolean;
  /** Add `upgrade-insecure-requests`. Only when the site is served over HTTPS. */
  https?: boolean;
};

export function buildCsp({ nonce, dev = false, https = false }: CspOptions): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
    ...(https ? ['upgrade-insecure-requests'] : []),
  ];
  return directives.join('; ');
}

/** A fresh unpredictable nonce (128 bits, base64). */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Two years, subdomains included. Sent only over HTTPS (browsers ignore it on HTTP anyway). */
export const HSTS_VALUE = 'max-age=63072000; includeSubDomains';
