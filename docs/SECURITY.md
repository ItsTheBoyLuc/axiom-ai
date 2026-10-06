# Security

Review of the custom authentication (we deviated from Auth.js, see `docs/DECISIONS.md`), the web security headers, rate limiting, and the deployment surface. Reviewed 2026-10-05 against the code at the Phase 10 commit. Each finding says what was checked, what was found, what was changed, and which test pins it.

## Summary

| Area                              | Result                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Session cookie flags              | Good. `HttpOnly`, `SameSite=Lax`, `Secure` and the `__Host-` prefix over HTTPS.                                                         |
| Session fixation and rotation     | **Fixed:** signing in or up again retires the session the browser presented. Tokens were already server-minted only.                    |
| Session lifetime in the browser   | **Fixed:** the cookie now slides together with the server-side session (it used to expire 7 days after sign-in regardless of activity). |
| CSRF                              | Good. SameSite=Lax plus a same-origin check on every state-changing route.                                                              |
| Argon2id                          | Good. OWASP-minimum parameters (19 MiB, 2 passes, 1 lane), transparent rehash.                                                          |
| Rate limits (Redis)               | Good for auth. **Added:** the public API (240/min per address) with `RateLimit-*` headers.                                              |
| Account enumeration               | Sign-in is uniform. Sign-up reveals a taken email (known limitation, below).                                                            |
| RBAC on admin and account routes  | Good. One shared guard and tests that fail if a route is not wrapped.                                                                   |
| Error messages                    | Good. Generic 500s; validation errors carry field paths only.                                                                           |
| CSP and headers                   | **Added:** nonce-based CSP, HSTS over HTTPS, COOP, tighter Permissions-Policy.                                                          |
| Personal data on account deletion | **Fixed:** the audit log kept the deleted person's email and IP. It is now scrubbed.                                                    |
| Database privileges               | **Added:** web and worker connect as a least-privilege role without DDL.                                                                |
| Dependencies                      | Production audit clean. One dev-only advisory without an upstream fix (below).                                                          |

## 1. Authentication

### Session cookie (`server/auth/cookie.ts`)

- Name `axiom_session`; over HTTPS `__Host-axiom_session`. The prefix makes the browser refuse the cookie unless it is `Secure`, has `Path=/` and has no `Domain`, so a sibling subdomain or a plain-HTTP response cannot plant or overwrite it.
- `HttpOnly` (scripts cannot read it), `SameSite=Lax`, `Expires` set. The value is a random 256-bit token; only its SHA-256 is stored, so a database leak yields no usable session.
- `Secure` follows `APP_URL`. **Run production on HTTPS** (Cloudflare Tunnel or a TLS proxy); on plain HTTP the cookie is `axiom_session` without `Secure`.

### Lifetime, rotation and fixation (`server/auth/sessions.ts`, `handlers.ts`)

- The server alone mints tokens; a client-supplied token is only ever looked up, never adopted, so classic fixation (an attacker choosing the victim's session id) is impossible. Test: `never accepts a session token chosen by the client`.
- **Fix:** a sign-in or sign-up from a browser that already holds a session now deletes that session. A stale or planted session cannot survive a new sign-in. A failed sign-in leaves the existing session alone. Tests: `session rotation and cookie lifetime` in `tests/integration/auth.test.ts`.
- Sign-out deletes the session server-side. Changing the password deletes all other sessions. Admin role changes, "sign out everywhere" and account deletion delete sessions. A demotion applies on the very next request because the role is read from the database every time.
- Lifetime is 7 days, extended after 1 day of use. **Fix:** the extension was only recorded in the database, so the browser's cookie still expired 7 days after sign-in. `GET /auth/session` now re-issues the cookie when the session slides. Test: `re-issues the cookie when the session slides`.

### CSRF (`src/lib/auth/csrf.ts`, `server/auth/guard.ts`)

- Layer 1: `SameSite=Lax` stops cross-site POSTs in current browsers. Layer 2: every state-changing route requires `Origin` (or `Sec-Fetch-Site`) to be the site's own origin; a request with neither header is accepted only if it carries no cookie, so it cannot ride a victim's session. All JSON; no state change on GET. Tests cover sign-in, sign-out, every admin route and `/me`.

### Passwords (`server/auth/password.ts`, `src/lib/auth/credentials.ts`)

- Argon2id via `@node-rs/argon2`: memory 19 456 KiB, 2 iterations, parallelism 1 (the OWASP minimum configuration), random salt, PHC string stores the parameters, and hashes made with weaker parameters are upgraded on the next successful sign-in. If the host has spare memory, raising `memoryCost` is the first knob to turn.
- Policy: 12 to 128 characters, no composition rules (NIST 800-63B), common passwords, passwords with three or fewer distinct characters and passwords containing the email name are refused, server side. The same function runs in the browser for live hints.
- The admin CLI (`npm run admin:create`) generates a random password and writes it only to a git-ignored file; it refuses to run if that file is not ignored.

### Rate limits (`server/auth/rate-limit.ts`, Redis, in-memory fallback)

| Limit                             | Rule                                                     |
| --------------------------------- | -------------------------------------------------------- |
| Sign-in                           | 30 per 15 min per address, 8 per 15 min per account      |
| Sign-up                           | 10 per hour per address, 500 per hour in total           |
| Password change, account deletion | 5 per 15 min per user                                    |
| `/me/*`                           | 600 reads and 120 writes per minute per user             |
| `/admin/*`                        | 600 reads and 120 writes per minute per admin            |
| Public API `/api/v1/*`            | 240 per minute per address (`API_RATE_LIMIT_PER_MINUTE`) |

- Fixed windows in Redis (`INCR` plus `EXPIRE`, with repair of a counter that lost its expiry). If Redis is unreachable the limiter falls back to per-process memory: protection degrades instead of disappearing (it never fails open).
- **The client address comes from a header set by the reverse proxy** (`CLIENT_IP_HEADER`, default `x-forwarded-for`; `cf-connecting-ip` behind Cloudflare). The app must not be reachable directly from the internet, or a client could choose its own address and dodge per-address limits. Compose publishes the web port on loopback only for this reason. Per-account and global limits do not depend on the header.
- Trade-off: the per-account sign-in limit means someone who knows an email address can lock that account out of sign-in for 15 minutes by failing 8 times. That is accepted over online guessing. There is no notification yet.

### Account enumeration

- **Sign-in:** one uniform `401 INVALID_CREDENTIALS` for an unknown email, a wrong password and a passwordless account; a dummy Argon2 verification is spent for unknown emails so timing does not differ.
- **Sign-up:** answers `409 EMAIL_TAKEN`, which tells a caller that an account exists. Removing that requires sending email ("check your inbox"), which needs outgoing-mail credentials. Mitigations: 10 sign-ups per address per hour, and the hash is computed before the lookup so timing is the same. Listed as a known limitation.

## 2. Authorization

- Every `/api/v1/admin/*` handler is wrapped by `adminRoute` and every `/api/v1/me/*` handler by `meRoute`, both thin wrappers over `server/auth/guard.ts`: session, role read from the database, same-origin on writes, per-user rate limit, no-store JSON. Anonymous callers learn nothing else about the route (`401` first).
- Tests enumerate every `route.ts` under both trees and fail if one exports an unwrapped handler (`admin-rbac.test.ts`, `account.test.ts`); an RBAC matrix covers every admin endpoint for anonymous (401), user (403), admin (allowed), forged or expired session (401) and cross-origin (403).
- Pages re-check the session themselves (`requireAdminPage`, `requireUserPage`); `src/proxy.ts` only redirects visitors without any session cookie and is not a security boundary. Non-admins get 404 on admin pages and 403 from the API.
- Every account query is scoped to `ctx.user.id`; saved items of one account are not readable by another (test `saved models are private to the account`). Nobody becomes an admin by signing up (test), the last administrator cannot be demoted or deleted.
- Import approval can never lower stored trust without an explicit, audited override (`TRUST_GUARD`).

## 3. Web security headers

Set per request by `src/proxy.ts` and statically by `next.config.ts` (tests: `tests/unit/csp.test.ts`, `tests/e2e/security.spec.ts`).

| Header                            | Value                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy` (pages) | `default-src 'self'`; `script-src 'self' 'nonce-…' 'strict-dynamic'` (no `unsafe-inline`, no `unsafe-eval`); `style-src 'self' 'nonce-…'`; `style-src-attr 'unsafe-inline'`; `img-src 'self' data: blob:`; `font-src 'self'`; `connect-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests` over HTTPS |
| `Content-Security-Policy` (API)   | `default-src 'none'; frame-ancestors 'none'`                                                                                                                                                                                                                                                                                                                                       |
| `Strict-Transport-Security`       | `max-age=63072000; includeSubDomains`, only over HTTPS                                                                                                                                                                                                                                                                                                                             |
| `X-Content-Type-Options`          | `nosniff`                                                                                                                                                                                                                                                                                                                                                                          |
| `X-Frame-Options`                 | `DENY`                                                                                                                                                                                                                                                                                                                                                                             |
| `Referrer-Policy`                 | `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                                                                                                                  |
| `Permissions-Policy`              | camera, microphone, geolocation, payment, usb all denied                                                                                                                                                                                                                                                                                                                           |
| `Cross-Origin-Opener-Policy`      | `same-origin`                                                                                                                                                                                                                                                                                                                                                                      |
| `X-Powered-By`                    | removed                                                                                                                                                                                                                                                                                                                                                                            |

- A fresh 128-bit nonce is generated for every request. Next.js applies it to its own scripts; the inline theme script and Radix's scroll-lock `<style>` carry it too (`CspNonce`). Because a nonce can only be applied while rendering, **every page is rendered per request** (the root layout reads the request headers); data stays cached in Redis. This replaced the hourly static regeneration of profile pages.
- The one concession is `style-src-attr 'unsafe-inline'`: React renders `style="…"` attributes (chart geometry, CSS variables) that cannot carry a nonce. Attribute styles cannot execute script.
- Zod's optional `new Function` probe is switched off in the browser (`src/lib/zod-browser.ts`) so the policy needs no `unsafe-eval`. The Playwright suite listens for `securitypolicyviolation` events on every main route, the palette, menus and the admin pages and fails on any.
- **Scroll experience (Phase 11) needed no policy change.** GSAP, ScrollTrigger and Lenis are bundled and served from `'self'` (loaded as dynamic chunks that inherit the nonce through `'strict-dynamic'`); the background is a 2D canvas with no `blob:` or `eval` use. The `?debug=scroll` overlay is compiled in but only answers in development or when `ENABLE_DEBUG_OVERLAY=true`, so a production deployment does not expose it. The Playwright suite listens for CSP violations while scrolling the whole page with the engine running.
- Not set: `Cross-Origin-Embedder-Policy` / `Cross-Origin-Resource-Policy` (nothing needs cross-origin isolation, and they can break embeds).

## 4. Input, output and data handling

- Zod validates every input; query strings and bodies are strict (unknown keys rejected). Bodies are size-limited (413) and must be JSON (415).
- Database access goes through Prisma (parameterised). The only hand-written SQL is two static statements (stats and the sources summary) with no user input.
- Errors: `toErrorResponse` returns the spec envelope; anything unexpected is logged server-side and answered with a generic `500`. No stack traces, SQL or paths reach clients. `next` redirects after sign-in accept only same-site relative paths (CRLF, backslash, `//` and absolute URLs refused).
- React escapes output; the only `dangerouslySetInnerHTML` uses are the theme and motion init scripts (constants, one inline script) and JSON-LD built from our own data with `<` escaped. `/api/docs` HTML-escapes every value and ships under its own `default-src 'none'` policy.
- The motion setting (`system`, `full`, `reduced`) is a Zod enum in the account preferences and a whitelisted value in `localStorage` (`axiom-motion`, listed on `/cookies`); an unknown value is ignored. It is read by an inline script that carries the CSP nonce.
- Environment is validated at boot (`src/lib/env.ts`). A test scans the built client bundles and fails if a connection string, a password variable name, `passwordHash` or the Argon2 module appears in them.
- **Audit log:** admin actions record actor, before and after values and the address (secrets redacted). When someone deletes their own account, earlier entries about the account lose their email and address, and the deletion is logged without either (test: `needs the password, removes the person…`). Before this change the log kept the email and IP after deletion.
- The sync worker's HTTP client refuses localhost, private, link-local and CGNAT addresses (also after DNS resolution and on redirects), honours robots.txt, and is https-only. Known limit: DNS is resolved by the guard and again by `fetch`; run the worker with an egress firewall (`docs/DEPLOYMENT.md`).

## 5. Deployment hardening

- Containers run as a non-root user with all capabilities dropped, `no-new-privileges`, and a read-only root filesystem (only `/tmp` and the Next.js cache are writable). Verified in CI.
- **Least-privilege database role** `axiom_app` (`docker/initdb/01-app-role.sh`): `SELECT`, `INSERT`, `UPDATE`, `DELETE` only; no DDL, no `TRUNCATE`, no superuser. Web and worker connect as it; only the one-shot `migrate` service (migrations, seed, `admin:create`) uses the owner. CI checks that `axiom_app` cannot create a table.
- Postgres and Redis are published on loopback only; the web port too (`WEB_BIND`). Redis has no password because it is not reachable from outside the Compose network or loopback; if you publish it, set one.
- Images: multi-stage, production dependencies only in the worker image. No secret is baked in; configuration comes from the environment.

## 6. Dependencies

- `npm audit --omit=dev --audit-level=high` blocks CI and reports 0 vulnerabilities.
- Full `npm audit` reports 5 high advisories in one chain, **dev only**: `braces` (stack exhaustion on deeply nested brace patterns) via `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `eslint-config-next`. Re-checked 2026-10-05: `braces` 3.0.3 is the latest release and is the affected one, so there is no patched version to override to, and `npm audit fix --force` would downgrade `eslint-config-next` to 14. It only runs inside our linter on our own files, never in the deployed image. The strict all-dependency gate therefore **cannot be restored yet**; the full audit stays visible (non-blocking) in CI. Revisit when `braces` or `eslint-config-next` ships a fix.
- Prisma `overrides` (`mysql2`, `deepmerge-ts`): re-checked 2026-10-05, `prisma` 7.10.0 is still the newest 7.x and still pins the vulnerable versions; the only newer line is `8.0.0-rc.19` (a prerelease and a major bump). Overrides stay. Hard limit to revisit: 2026-12-31.

## Known limitations

These are open on purpose or because they need something we do not have. None blocks a first deployment; all are worth doing before wide public use.

1. **No email verification.** Accounts are created with `emailVerified = null`; an address is not proven to belong to the person. Needs outgoing-mail credentials.
2. **No password reset by email.** A forgotten password cannot be recovered by the user; an administrator can rotate an admin password with the CLI, but ordinary accounts have no recovery path. Same dependency as above.
3. **Sign-up reveals taken addresses** (see Account enumeration). Fixed by the same email flow.
4. **No multi-factor authentication** for administrators. Put `/admin` behind Cloudflare Access (or a VPN) in production, which also gives it MFA.
5. **No absolute session lifetime.** A session that is used at least once a day lasts until sign-out. The session table has no creation time; adding one allows a 30-day cap.
6. **Per-account sign-in lockout can be triggered by someone else** (8 failures per 15 minutes) and the owner is not notified.
7. **In-memory rate-limit fallback is per process**, so with several web replicas and Redis down the effective limit multiplies.
8. **`style-src-attr 'unsafe-inline'`** (see Web security headers).
9. **No GitHub sign-in** (needs OAuth app credentials from the owner).
10. **No automated security scanning of images** (e.g. Trivy) in CI yet.
11. **Security headers depend on the proxy for the client address**, as described above.

## Reporting a vulnerability

Use the address on the contact page (`CONTACT_EMAIL`). Please do not open a public issue for a security problem.
