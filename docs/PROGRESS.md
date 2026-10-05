# Progress

Living status of the build. `CLAUDE.md` holds the rules (including Autopilot mode), `docs/PROMPT.md` the spec, `docs/DECISIONS.md` the reasoning, `docs/DATA_STATUS.md` the data coverage, `docs/MOTION.md` the motion values. Update this file in the same commit as the work it describes.

## Phases

| Phase | Scope                                                           | Status                                                                                      |
| ----- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 0     | Foundation (Next.js, worker, Compose, CI)                       | Done                                                                                        |
| 1     | Brand, design system, homepage                                  | Done                                                                                        |
| 2     | Model directory and profiles (demo data)                        | Done                                                                                        |
| 3a    | Prisma schema, migrations, REST API, seed pipeline              | Done (2026-10-02, CI green)                                                                 |
| 3b    | Real, sourced seed data + `docs/DATA_STATUS.md`                 | Done 2026-10-03 (all 3 batches loaded, checked, audited, demo removed from pages, CI green) |
| 4     | Compare (`/compare`, charts, share URL, CSV, history)           | Done 2026-10-03 (see below)                                                                 |
| 5     | Benchmarks (`/benchmarks` explorer, charts, filters)            | Done 2026-10-03 (see below)                                                                 |
| 6     | Providers and releases (directory, profiles, `/releases`, GSAP) | Done 2026-10-03 (see below)                                                                 |
| 7     | News and global search (`/news`, `/search`, palette)            | Done 2026-10-03 (see below)                                                                 |
| 8     | Admin, auth core, data sync                                     | Done 2026-10-03 (see below)                                                                 |
| 9     | Accounts and personalization                                    | Done 2026-10-05 (see below)                                                                 |
| 11    | Cinematic scroll experience (deliberate plan change)            | In progress (see Phase 11 status below)                                                     |
| 10    | Production readiness                                            | Done 2026-10-05 (see below)                                                                 |

## Phase 3b status

- **Batch 1 (2026-10-02):** 3 providers, 15 models, 77 prices, 67 benchmark results (34 benchmark variants), 21 releases. Self-audit of 8 random records: 0 mismatches (see `docs/DATA_STATUS.md`). Real data loaded into the dev database; screenshots of `/models` and profiles at 1440 and 390 reviewed.
- **Fixed on the way:** reduced-motion hydration error (regression test added), capabilities matrix empty on real data (controlled benchmark categories), hero "DEMO DATA" over real data, long names truncating, monogram "O" looking like a zero, `.dockerignore` and CI gaps from 3a.
- **Batch 2 (2026-10-02):** 4 providers, 11 models, 36 prices, 37 benchmark results, 12 new benchmark variants, 15 releases; every source verified directly (see `docs/DATA_STATUS.md`). Also fixed: card price summary for tiered pricing, and two CI-only e2e flakes (streaming staging element; axe scanning a moving sheet). CI is green on `c86acb7`.
- **Batch 3 (2026-10-03):** 5 providers, 8 models, 9 prices (incl. Nova 2 Lite via a rendered AWS page), 46 benchmark results, 12 releases, 18 news items, 6 publications. Source re-check of every item that was read only through the summarising fetcher, and a self-audit of 8 random records: 0 value mismatches (1 labelling caveat: DataCamp's date is an "Updated" date); see `docs/DATA_STATUS.md`. Loaded into the dev database (34 models, 12 providers, 122 prices, 150 results, 48 releases, 18 news); `/models`, profiles of every new provider and the homepage reviewed at 390/768/1440 (no horizontal overflow, no console errors).
- **Fixed on the way:** cost estimator rejected qualified units (Nova 2 Lite); homepage releases and news were hardcoded demo content (now from the database with source links); a news card repeated the publisher as provider. Demo dataset moved to `prisma/seed/demo/fixtures.ts` (fixtures only).
- **Gates 2026-10-03:** prettier, typecheck, lint, 219 unit, 206 integration, 78 Playwright (axe, both themes), production build, BOM check: all green. `npm audit` (all deps) reports 5 high, one dev-only chain (`braces`, no patched release); `--omit=dev` reports 0. **Decided 2026-10-03:** the blocking CI audit is now `--omit=dev`, plus a non-blocking "Full audit (informational)" step. Revisit when `braces` or `eslint-config-next` is fixed, and at the latest in Phase 10 (restore the strict gate if possible); see `docs/DECISIONS.md`.
- **Next step:** Phase 4 (Compare) per `CLAUDE.md` Autopilot rules.

- **Phase 7 must label the DataCamp news item's date as "updated", not "published"** (the source shows only an update date; see `docs/DATA_STATUS.md`).

## Phase 4 status

- **Built (2026-10-03):** `/compare?models=a,b,c` (max 4): table in 5 groups with a differences toggle and a shared-benchmarks filter; charts (context window, input and output price, one benchmark at a time, radar only for comparable % benchmarks) with table view and CSV; selector with search, provider and category filters, recently viewed and comparison history; copy link; CSV export; tray follows the URL. Save-to-account is deferred to Phase 9 and not rendered.
- **Real-data fixes found on the way:** CSV priced only the plain unit (now every variant); the homepage preview had hard-coded demo wording; radar labels were clipped.
- **Gates:** prettier, typecheck, lint, 260 unit, 206 integration, 105 Playwright (axe in both themes on `/compare`, mobile no-overflow, reduced motion, hydration), build, BOM: green. Screenshots reviewed at 390, 768 and 1440 with real data (Claude Opus 5.5 / GPT-6 Sol / Gemini 3.8 Flash; Gemini 3.7 vs 3.8 Flash for the radar).
- **Known limitation:** real benchmark results overlap little between models (variants are separate records), so the table has many "No verified data" cells and the radar appears only for closely related models. That is the data, not a bug.

## Phase 5 status

- **Built (2026-10-03):** `/benchmarks` index (59 benchmarks by category, totals, evaluation-type mix per card) and a per-benchmark detail view with URL-state filters (provider, family, model version, evaluation type, date range), four charts (latest per model, scores over time, distribution, provider dot plot; each with table view and CSV) and a results table showing evaluation type, date, model and benchmark version, methodology and source on every row. Benchmark summaries gained `modelCount`, `latestDate`, `byType` and `units` (one aggregate SQL statement).
- **Honest about sparse, provider-reported data:** all 150 results are provider reported and the median benchmark has 2 results, so the overview always prints the independent count (0) with a note, and charts that would be meaningless (distribution under 5 models, provider comparison under 2 providers, history on one date) are replaced by a note saying why. No aggregate, ranking or "best" is computed.
- **Gates:** prettier, typecheck, lint, 313 unit, 207 integration (incl. an N+1 guard that caught my first 4-query aggregate and an aggregate-vs-results invariant), 139 Playwright (axe in both themes on index, detail and filtered detail; mobile no-overflow; reduced motion; hydration), build, production audit, BOM: green. Screenshots reviewed at 390, 768 and 1440 with real and fixture data.

## Phase 6 status

- **Built (2026-10-03):** `/providers` (search, type chips, cards with latest announcement), `/providers/[slug]` (overview, filterable portfolio, release timeline chart + entries, APIs and modalities, research, news), `/releases` (timeline with GSAP scroll effects and list views; search, provider, kind and date filters; pager). `ProviderSummary.latestRelease` added (one `DISTINCT ON` statement).
- **Real data:** 12 providers (none has a verified headquarters, so none is shown), 48 releases (all confirmed), 6 publications, 18 news items. Reviewed with real data at 390 and 1440 (directory, OpenAI and Google DeepMind profiles, timeline and list), and fixture data at 390, 768 and 1440.
- **Gates:** prettier, typecheck, lint, 360+ unit, 208 integration, Playwright (axe in both themes on directory, profile, timeline, list and empty states; GSAP effect and reduced-motion checks; mobile no-overflow; hydration), build, production audit, BOM: green.

## Phase 7 status

- **Built (2026-10-03):** `/news` (News and Research tabs, featured official announcements, source and category chips with counts, search and provider filters, pager, JSON-LD), `/search` (grouped results, type chips, highlighting), and the command palette wired to the real search API (chips, recent searches, suggestions, "See all", keyboard operation, external hits in a new tab). Backend: news `official` filter and facets, `GET /api/v1/research`, `NewsArticle.dateIsUpdated` (migration) and release search links to the provider anchor.
- **DataCamp:** now labelled "Updated 3 Sept 2026" everywhere (flag in the data, schema, API, card, JSON-LD).
- **Gates:** see the commit; prettier, typecheck, lint, unit, integration, Playwright (axe in both themes on news, research, search and the open palette; mobile; reduced motion; hydration), build, production audit, BOM.

## Verification log

- Phase 3a (2026-10-02): migrations from empty, 206 integration tests, 70 Playwright tests, production build without a database, full Docker stack healthy and non-root, Prisma overrides reviewed (still required).
- Batch 1: unit tests include `real-seed-data.test.ts` (8) and the search-race tests; Playwright includes `hydration.spec.ts` (6). Run the full gate list before each commit (see Autopilot rules).

## Open items

See `docs/SECURITY.md` (known limitations: email verification, password reset, MFA, absolute session lifetime, image scanning) and `docs/DECISIONS.md` (GitHub sign-in skipped, strict audit gate not restorable yet, Prisma overrides until 2026-12-31). Data: all 150 benchmark results are provider reported (no independent leaderboard was read), no sync sources are configured.

## Phase 8 status

- **Built (2026-10-03):**
  - Auth core: Argon2id, hashed DB sessions, sign-in/out/me API, `/sign-in`, `proxy.ts` guard, `npm run admin:create` (see DECISIONS: custom sessions instead of Auth.js).
  - Admin (`/admin`): dashboard with counts and recent changes; schema-driven create/edit/delete for providers, models, benchmarks, benchmark results, pricing, releases, news and publications; users; audit log; data sync (sources, runs with validation issues, imports review, approve/reject with trust-guard override).
  - Sync system: RSS/Atom, GitHub releases and Hugging Face adapters behind a polite, SSRF-guarded HTTP client; validation, diff and staging pipeline; BullMQ worker with scheduler and heartbeat.
- **Not done on purpose:** no sync sources are pre-configured (feed URLs would have to come from memory); add real ones from `/admin/sync`. The worker has not fetched anything real yet: all network behaviour is covered with scripted responses.
- **Gates:** see the commits (prettier, typecheck, lint, unit, integration, Playwright with axe in both themes on every admin page, production build, production audit, BOM, worker image build).
- **Next:** Phase 9 (sign-up, saved comparisons and models, preferences, recently viewed, account menu, optional GitHub sign-in) on top of the auth core.

## Phase 9 status

- **Built (2026-10-05):** sign-up, account menu in the navbar and mobile drawer, `/account` (saved models, saved comparisons, recently viewed), `/settings` (theme, preferred providers, "For you" switch, change password, delete account), `/api/v1/me/*`, Save buttons on profiles and `/compare`, "For you" on the home page, anonymous parity. GitHub sign-in skipped (needs OAuth credentials), email verification and password reset not built (need mail credentials); see `docs/DECISIONS.md`.
- **Gates:** prettier, typecheck, lint, 520 unit, 451 integration, 353 Playwright (axe in both themes on sign-up, account, settings, the open account menu and the home page), production build, production audit, BOM, web/worker/migrate image builds: green. Screenshots reviewed at 390, 768 and 1440 (signed in and out).

## Phase 10 status

- **Built (2026-10-05):** nonce-based CSP, HSTS, COOP and tighter Permissions-Policy; Redis rate limiting for `/api/v1/*`; session rotation and cookie sliding; least-privilege DB role and hardened Compose (read-only, no capabilities, loopback ports, optional Cloudflare Tunnel profile); backup, restore-test and restore scripts; CI Docker job; real About, Methodology, Sources, Contact, Privacy, Terms and Cookies pages (replacing the placeholders); `robots.txt`, `sitemap.xml`, indexable `/models`; LCP fixes; `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, `docs/API.md` (generated), README, final `docs/DATA_STATUS.md`.
- **Bugs found by actually exercising it:** `admin:create` created an administrator and then lost the password inside a container (EACCES) and is now fail-first with `--out`; deleting an account left the email and IP in the audit log; `/models` was `noindex`; the sign-up password hint never showed (`??` on `''`); every page was invisible until hydration, which made LCP 4 to 5 s; ISR pages cannot carry a CSP nonce. The new CI Docker job (clean checkout, Linux) found two more on its first runs: the empty `public/` directory was not in git, so the web image could not be built from a clone, and the `./backups` bind mount made Docker create the directory as root, so the backup script could not write to it (the mount was never needed and is gone). CI is green on `a808b10` (check and docker jobs).
- **Gates:** prettier, typecheck, lint, 532 unit, 461 integration, 379 Playwright (axe in both themes on every page incl. content pages and the open account menu, CSP violation listener on every main route and the admin pages, mobile no-overflow, reduced motion, hydration), production build, production audit (0), BOM check, web, worker and migrate image builds, full Compose stack healthy with a real backup, restore test and destructive restore.
- **Lighthouse and Core Web Vitals** (production container, real data, 2026-10-05, Lighthouse 13.5, Chrome headless; budget LCP < 2.5 s, CLS < 0.1, INP < 200 ms):

| Page                  | Desktop perf / LCP / TBT / CLS | Mobile (slow 4G, 4x CPU, applied throttling) perf / LCP / TBT / CLS | Mobile (Lighthouse simulated) perf / LCP |
| --------------------- | ------------------------------ | ------------------------------------------------------------------- | ---------------------------------------- |
| `/`                   | 98 / 1.1 s / 0 ms / 0          | 81 / 2.5 s / 530 ms / 0                                             | 76 / 5.1 s                               |
| `/models`             | 100 / 0.7 s / 0 ms / 0         | 95 / 2.1 s / 130 ms / 0                                             | 88 / 3.9 s                               |
| `/models/<slug>`      | 99 / 0.9 s / 0 ms / 0.001      | 95 / 2.1 s / 170 ms / 0                                             | 89 / 3.7 s                               |
| `/compare?models=a,b` | 99 / 0.8 s / 0 ms / 0.004      | 75 / 2.0 s / 930 ms / 0.07                                          | 80 / 4.3 s                               |

Accessibility 100 and best practices 100 on all four; SEO 100 except `/compare?models=...` (91: the metadata of that noindex page streams into the body). Real unthrottled LCP measured with a PerformanceObserver on an emulated Pixel 7 was 0.4 to 1.1 s. **Honest reading:** under applied throttling every page is at or within rounding of the 2.5 s LCP budget (home is exactly 2.5 s); Lighthouse's simulated mobile mode, which also models all script work as a dependency of the paint, still reports 3.7 to 5.1 s, so mobile LCP on a slow phone is borderline, not comfortably passing. The remaining cost is about 250 to 470 kB of JavaScript (framework, Motion, Recharts on `/` and `/compare`) and TBT on `/compare` (930 ms throttled). INP was not measured (no field data; Lighthouse does not report it). Before this phase LCP was 4.1 to 5.7 s: the page was invisible until hydration (fixed), and `/models` shipped Zod to the browser (removed).

## Phase 11 status (cinematic scroll experience)

**Plan change (2026-10-05):** order is now Phase 11 -> sync-up -> final audit. Phase 10 was already done and is only re-checked in the sync-up step. Step log (one line per step, commit and push after each):

- Step 0: plan change recorded in CLAUDE.md, PROGRESS.md and DECISIONS.md.
- Step 1 (2026-10-05): **diagnosed** (see below), baseline Lighthouse saved in `docs/PERFORMANCE.md`, motion setting added (System default / Full motion / Reduced, in `/settings` and the footer, persisted locally and in the account). Bug found on the way: `themeInitScript` was imported from a `'use client'` module into the server layout; concatenating it with another script produced `function(){throw Error(...)` as the inline script, which the new e2e test caught.
- Steps 2-4 (2026-10-05): `src/components/cinematic/*` (engine, canvas background, text splitter, config), homepage markup contract (`data-cine-*`), hero and CTA magnetic buttons, `/about`, `/releases`, provider profiles on the light level, releases timeline focus effect. Verification in progress.

### Diagnosis: why no scroll animation was visible (Chromium 1440x900, before Phase 11)

- With `reducedMotion: 'no-preference'`: Lenis **was** running (`html.lenis`, smooth wheel scrolling) and one GSAP ScrollTrigger **was** created, but it only moved the hero headline up by about 80 px and faded it to 15% over the first screen, and the hero canvas drifted a little. The canvas lived inside the hero only and its hash stopped changing after the first screen; **everything below the hero had no scroll-linked effect at all**, only once-only fades (Phase 10 reveals). No pins, no scrub, no background change per section.
- With `reducedMotion: 'reduce'` (what Windows does when "Show animations in Windows" is off): no canvas, no Lenis, no ScrollTrigger, nothing moves. **If your OS has that setting off, you see a completely static page.**
- So: not a bug in the libraries (they were initialised), but effects that were far too small and confined to the first screen, and none of it for reduced-motion users. No real bug to fix there.
