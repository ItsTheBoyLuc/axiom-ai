# Decisions log

Format: date - decision - reason. Locked choices from the master prompt (section 3) are not repeated here.

## 2026-09-29 - Step 0

- **Repo location:** `axiom-ai/` subfolder of the VSC workspace, with its own git repo, so it stays isolated from the other projects there.
- **Next.js 16 / React 19 / Tailwind 4 / Zod 4 / Prisma 7:** latest stable resolved by npm at scaffold time. Prisma CLI pinned to `^7` to match `@prisma/client` (npm had resolved the CLI to an 8.0 release candidate).
- **Prisma 7 config:** connection URL lives in `prisma.config.ts`; the schema is a stub until Phase 3.
- **Health check uses `pg` directly:** avoids needing the Prisma client/adapter before the schema exists. Phase 3 will reuse `pg` via `@prisma/adapter-pg`.
- **Worker runs through `tsx` in production:** the worker shares `src/lib` and `server/` TypeScript with the web app, so this avoids a second build pipeline. `tsx` is a runtime dependency. Revisit (esbuild bundle) in Phase 10 if image size matters.
- **One Dockerfile, two targets (`web`, `worker`):** shared dependency layers, non-root users, healthchecks on both.
- **Postgres and Redis ports bound to 127.0.0.1** so the compose stack is not exposed on the LAN.
- **CSP deferred to Phase 10:** other security headers are set now in `next.config.ts`.
- **`docs/PROMPT.md` not saved automatically:** the master prompt was pasted in chat. Save it there manually if you want it in the repo.

## 2026-09-29 - Phase 1

- **"Not built yet" pages for future routes:** the spec mandates nav items, hero CTAs and footer links to routes built in later phases. Rather than 404 (or hide required CTAs), `app/[slug]/page.tsx` renders an honest placeholder (`noindex`) for slugs listed in `lib/routes.ts` `pendingRoutes`. Delete a slug when its phase ships.
- **Account menu omitted from navbar:** auth is Phase 9; rendering it now would be dead UI.
- **Command palette is a page-navigation shell:** no category chips, recent searches or "see all results" until Phase 7 wires real search.
- **`--text-muted` lightened to `#8A93A6` in dark theme:** the spec value `#747D90` measures ~4.2:1 on `--bg-card`, failing WCAG AA. Light-theme accents and status colors were darkened for the same reason (axe verified).
- **Demo data uses fictional names** ("Demo Provider A", "Sample Model 1") with invented values, all `isDemo: true` and badged. No real provider/model facts are used before Phase 3.
- **`/design` is dev-only:** returns 404 in production unless `ENABLE_DESIGN_PAGE=true` (read per request). Playwright sets it.
- **Theme:** custom `useSyncExternalStore` provider + inline pre-paint script instead of `next-themes` (fewer dependencies, no flash).
- **Charts:** `BarChart` takes a serializable `valueFormat` key, not a function, so server components can use it. Recharts is loaded via `next/dynamic` on the homepage.
- **GSAP + ScrollTrigger** are dynamically imported inside `HeroScroll` (homepage only) and skipped under reduced motion.
- **Windows gotcha:** PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM, which broke the CSS build once. Use the editor tools or `utf8NoBOM`-safe methods.

## 2026-09-29 - npm audit fix (CI)

- **Finding:** `npm audit --audit-level=high` failed with 4 high advisories, all transitive via `prisma@7.10.0` (the CLI, which `@prisma/client` also pulls in): `deepmerge-ts <8` (stack exhaustion on recursive objects, via `@prisma/config`) and `mysql2 <=3.23.0` (credential leak on auth-plugin downgrade; zlib decompression bomb). Not a direct dependency. `npm audit --omit=dev` also flagged them, because `prisma` is installed as a dependency of `@prisma/client`.
- **Reachability:** we use PostgreSQL only and never load the MySQL driver. `deepmerge-ts` only merges our own trusted `prisma.config.ts`. Real-world exposure is very low, but a fix was available so we took it instead of relaxing the audit.
- **Fix:** `overrides` in `package.json` pin `mysql2@^3.24.4` (same major) and `deepmerge-ts@^8.0.2` (major bump). No upstream 7.x release fixes this: `prisma@7.10.0` is the latest 7.x and pins the old versions exactly. `npm audit fix` (without `--force`) could not resolve it, and `--force` would downgrade Prisma to 6.x, which is out of policy (keep ^7).
- **Verified:** `npm audit` reports 0 vulnerabilities. `prisma --version`, `prisma validate` and `prisma generate` all work, and the CLI loads `prisma.config.ts` (the `deepmerge-ts` code path) correctly. Re-verify with `prisma migrate` in Phase 3.
- **Remove the overrides when:** a Prisma 7.x release ships with `deepmerge-ts >=8` and `mysql2 >3.23` itself. Review at the start of Phase 3 and Phase 10, whichever comes first (time limit: 2026-12-31).
- **CI:** `actions/checkout` and `actions/setup-node` bumped to v7 (current majors), which also clears the Node 20 deprecation warning.

## 2026-09-29 - Phase 2 (model directory and profiles)

- **Repository layer:** UI and route handlers depend only on `ModelRepository` (`server/repositories/model-repository.ts`). Phase 2 ships an in-memory demo implementation over a fictional dataset (16 "Sample Model N" records from "Demo Provider A-G", all `isDemo`, `UNVERIFIED`, no source URLs). Phase 3 adds a Prisma implementation and switches `getModelRepository()`. The pure filter/sort/search/facet logic lives in `server/repositories/model-query.ts` so it is unit tested independently of storage.
- **Deliberate data gaps in the demo set** (null context window, undisclosed output prices, no benchmarks, historical prices) exist to exercise every "Not publicly disclosed" / "No verified data" path.
- **URL contract:** multi-select filters are comma-separated (`?category=coding,llm`), lists are sorted so equal queries give equal URLs, defaults are omitted, unknown or malformed values are dropped (never an error), out-of-range pages are clamped. Filter, sort and page changes push history; typing in search replaces it (debounced 250ms).
- **Search semantics:** every whitespace-separated token must match (substring, case- and accent-insensitive) in name, family, provider, description, capabilities or categories; name > family/provider > capability/category > description for relevance. Single-letter tokens over-match by nature; revisit with `pg_trgm`/`tsvector` in Phase 3.
- **Sorting:** no relevance or overall ranking. "Benchmark score" sorts by exactly one user-chosen benchmark using each model's most recent result for it (so a newer independent 74% beats an older provider-reported 78%; results are never averaged). Models without a result sort last and read "No verified data". Undisclosed numeric values (context window) sort last.
- **Facet counts** are computed with the group's own filter removed, so alternatives stay visible while filtering. Every option is listed even at zero.
- **Provider filter:** listed providers plus an "Other" bucket (providers with tier `other`), as the spec asks.
- **Comparison tray** lives in the root layout and persists in `localStorage` (`axiom-compare`, max 4). "Compare" needs 2+ models and links to `/compare?models=a,b` (still the "Not built yet" page until Phase 4). A 5th model is refused visibly (disabled button with a reason), never silently dropped. **Recently viewed** (`axiom-recent`, max 12) is recorded on profile pages and shown on `/models`.
- **Not rendered because not built (no dead UI):** profile "Save" (needs accounts, Phase 9) and "Documentation" (only renders when a documentation URL exists; demo records have none).
- **`/api/v1/models/suggest`** was added ahead of the Phase 3 API for the search box. Zod-validated, spec error envelope, short CDN cache. Redis rate limiting arrives with the rest of the API hardening.
- **Cost estimator rules** (`src/lib/pricing.ts`): current prices only (never historical), per-1M-token unit only, cached input counted separately from input, a missing price makes the result _partial_ (lower bound, clearly flagged) and is never treated as free, mixed currencies are refused, values are rounded at 1e-9 to remove float noise, absurd inputs (>1e12) are rejected.
- **Capabilities matrix** cells come only from benchmark results whose category matches the row; three of the eight rows have no demo benchmark category, so they always read "No verified data".
- **SEO:** `/models` and every demo profile are `noindex` while the data is demo. Profiles have unique title/description, canonical URL, `SoftwareApplication` and `BreadcrumbList` JSON-LD (escaped so data cannot break out of the script tag).
- **Route group `(directory)`:** `loading.tsx` at `/models` also wraps nested `[slug]`, which makes unknown slugs stream as HTTP 200. The directory page, its loading and error files live in `app/models/(directory)/` so profile pages are outside that boundary and unknown models return a real 404.
- **Accessibility decisions:** the filter sidebar is a labelled `<section>` (an `<aside>` inside `<main>` nests landmarks); horizontally scrollable tables are focusable `region`s; select labels are associated by `htmlFor` (a wrapping label made the accessible name include the selected value); `scroll-padding` keeps focused elements clear of the fixed navbar and tray (WCAG 2.2 "focus not obscured"); the section nav derives the active item from scroll position (an IntersectionObserver band highlighted the previous section after anchor clicks).
- **Filter groups:** only Provider and Category start open (all five stacked exceed the sticky panel height); a group with an active selection always starts open.
- **Layout gotchas found by screenshots:** card grids need an explicit `grid-cols-1` (an implicit `auto` track grew to min-content and overflowed at 390px); never combine a base `inline-flex` with `hidden`/`lg:hidden` in one class list (it left the desktop-only "Hide filters" button visible on phones).
- **Test infrastructure:** `gotoReady()` waits for hydration (clicks before it are ignored, which flaked under load); axe scans wait for debounced navigations and animations to finish (results are intentionally dimmed while pending, which blends colours).
