# AXIOM AI — Claude Code Master Prompt

> **The Intelligence Standard.**
> Paste this whole file into Claude Code (VS Code) as the first message, or save it as `docs/PROMPT.md` and start with: _"Read docs/PROMPT.md fully, then execute §14 step 0 and stop."_

---

## 0. ROLE AND MISSION

You are a senior full-stack engineer, product designer, motion designer and data engineer working as one person. Build **AXIOM AI**: a premium, production-oriented web platform for discovering, researching, benchmarking and comparing the world's AI models (OpenAI, Anthropic, Google, Meta, xAI, DeepSeek, Mistral, Microsoft, NVIDIA, Alibaba, Cohere, Amazon and others).

It is a directory, a technical database, a benchmark explorer and a comparison tool in one. It must look and feel like a commercial SaaS product from a top-tier technology company. It is **not** a landing page, a template, or a Bootstrap-style dashboard. It must scale to thousands of models.

Quality bar: Linear, Vercel, Stripe, Anthropic, OpenAI, Apple. Take inspiration from their quality, never copy their layouts or assets.

---

## 1. OPERATING RULES (how you work)

1. **Plan before code.** Start every phase with a short plan (files to create, decisions, risks). Use your todo/task list and keep it current.
2. **Work in phases (§14).** Finish one phase completely, verify it, commit, then **stop and report** before starting the next. Do not skip ahead.
3. **Verify, don't assume.** After each phase run: typecheck, lint, unit tests, build, and start the app. Use Playwright to load the affected routes, take screenshots at 1440px and 390px widths, and inspect them. Fix what you find. You cannot judge animation feel from screenshots; list motion values you chose so I can tune them in the browser.
4. **No dead UI.** Every visible button, link, filter, sort, tab and control must work. If something is not built yet, do not render it.
5. **Commit per phase** with Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). Never commit secrets. Keep `.env.example` in sync.
6. **Persist context.** In step 0 create a `CLAUDE.md` in the repo root containing §1–§5 (rules, data integrity, stack, design tokens, commands). Update it whenever a decision changes.
7. **Ask only when blocked.** If a decision is not covered here, choose the most conventional option, record it in `docs/DECISIONS.md`, and continue.
8. **Windows 11 host.** Assume development on Windows 11 with Docker Desktop and VS Code. Use cross-platform npm scripts (no bash-only one-liners), set `.gitattributes` for LF line endings, and document PowerShell commands where shell commands are shown.
9. **Keep files small.** No monolithic components. Business logic lives in `server/` and `lib/`, presentation in `components/`.

---

## 2. DATA INTEGRITY (non-negotiable)

Accuracy is a core feature. AI model facts change constantly and your training data is out of date, so **never seed model facts from memory**.

- Seed data only from sources you can fetch and read during this session: official provider docs, pricing pages, announcements, model cards / Hugging Face repos, research papers, and independent benchmark organizations. Use your web fetch/search tools.
- Every sourced record stores: `sourceUrl`, `verificationStatus`, `verifiedAt`, `collectedAt`, `isDemo`.
- `verificationStatus` enum: `OFFICIALLY_VERIFIED`, `INDEPENDENTLY_EVALUATED`, `PROVIDER_REPORTED`, `COMMUNITY_REPORTED`, `UNVERIFIED`, `NOT_PUBLICLY_DISCLOSED`.
- If you cannot verify a value: store `null` and render **"Not publicly disclosed"** (or omit the record). Never guess, interpolate or "fill in plausible" values.
- Never fabricate: specifications, pricing, benchmark scores, release dates, capabilities, provider relationships, articles, or quotes attributed to real organizations.
- Any placeholder used for layout or tests is flagged `isDemo = true` and renders a visible **DEMO DATA** badge. Demo data must never be mixed silently with verified data.
- Seed files live in `prisma/seed/data/*.json` and are validated by Zod schemas that **reject** any record with `verificationStatus` other than `NOT_PUBLICLY_DISCLOSED`/`UNVERIFIED` and no `sourceUrl`.
- No arbitrary "overall score" or global model ranking anywhere. Never average or merge incompatible benchmarks. Always show benchmark name, version, methodology note, evaluation date, model version, source, and whether it is **independently evaluated** or **provider-reported**.
- Pricing: store currency, unit (e.g. per 1M tokens), effective dates, `isCurrent`, source and verification date. Historical prices stay in the table and are labelled historical.
- Never silently overwrite verified data with unverified data (see §9 approval flow).
- AI-generated summaries (news) must be labelled as such. Official announcements must be visually distinct from independent reporting.

---

## 3. LOCKED TECHNICAL DECISIONS

Decided so you don't stall. Change only with a note in `docs/DECISIONS.md`.

| Area               | Choice                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Next.js (latest stable, App Router), React, TypeScript `strict`                                                                                                                                                      |
| Styling            | Tailwind CSS with design tokens as CSS variables; `next/font` with **Geist Sans + Geist Mono**                                                                                                                       |
| UI primitives      | Radix UI primitives (accessible dialogs, dropdowns, tooltips, tabs), `cmdk` for the command palette, Lucide icons                                                                                                    |
| Animation          | **Motion for React** (`motion/react`) for UI; **GSAP + ScrollTrigger** only for the homepage hero/scroll sequences and `/releases`, dynamically imported; smooth scrolling via Lenis (disabled under reduced motion) |
| Hero visual        | Custom **canvas 2D** network (no Three.js, unless you justify a genuine benefit in `DECISIONS.md`)                                                                                                                   |
| Charts             | **Recharts** wrapped in a reusable chart system (§8)                                                                                                                                                                 |
| API                | Next.js Route Handlers under `/api/v1/*`, Zod validation, OpenAPI spec generated from Zod schemas, served at `/api/docs`                                                                                             |
| Database           | PostgreSQL 16 + **Prisma** + migrations; `pg_trgm` and `tsvector` for search (no external search engine)                                                                                                             |
| Cache / rate limit | Redis (cache, rate limiting, job queue)                                                                                                                                                                              |
| Background jobs    | Separate `worker` service (TypeScript, BullMQ on Redis, cron schedules) sharing the `server/` code                                                                                                                   |
| Auth               | Auth.js (NextAuth v5) with credentials (Argon2id hashing) + optional GitHub OAuth, database sessions, roles `USER` / `ADMIN`                                                                                         |
| Testing            | Vitest, React Testing Library, Playwright, Supertest-style API tests against a test Postgres                                                                                                                         |
| Infra              | Docker (multi-stage, non-root), Docker Compose (`web`, `worker`, `postgres`, `redis`), env-based config validated at startup                                                                                         |
| Lint/format        | ESLint, Prettier, `tsc --noEmit`, Husky + lint-staged                                                                                                                                                                |

---

## 4. BRAND IDENTITY

- **Name:** AXIOM AI. **Tagline:** "The Intelligence Standard."
- **Positioning:** precision, reliability, sophistication, enterprise-grade. Minimalist and futuristic.
- **Logo (create as SVG React component `Logo` with `mark` and `full` variants):** a custom geometric **A** built from clean strokes, with a distinctive negative-space detail (e.g. a cut crossbar or inset triangle). Must be legible at 16px, work on dark and light backgrounds (uses `currentColor` plus an accent), and not resemble a brain, neural net or generic AI icon. Wordmark "AXIOM AI" in Geist, tight tracking, medium weight. Generate `favicon.ico`, `icon.svg`, `apple-icon.png`, and a default OG image. Show mark + wordmark in the navbar.
- Provider logos: use official brand assets only where licensing allows; otherwise render a neutral monogram tile. Never redraw a company's logo.

---

## 5. DESIGN SYSTEM

### Tokens (dark is the default theme)

```css
:root[data-theme='dark'] {
  --bg-primary: #08090c;
  --bg-secondary: #0d0f14;
  --bg-elevated: #12151c;
  --bg-card: #151821;
  --accent: #5685ff; /* primary, electric blue */
  --accent-2: #43d9f5; /* cyan, sparingly */
  --accent-3: #9b7bff; /* violet, sparingly */
  --text: #f5f7fa;
  --text-2: #a0a7b7;
  --text-muted: #747d90;
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.14);
}
```

- **Light theme:** define a matching light token set (clean off-white background, same accent hues adjusted for WCAG AA contrast). Theme toggle with `system` / `dark` / `light`, persisted, no flash on load.
- **Type:** Geist Sans for UI and headings (large, tight tracking, generous line-height for body), Geist Mono for specs, IDs, token counts and prices. Fluid type scale.
- **Spacing/layout:** 4px base scale, 12-column container (max ~1280px), generous whitespace, identical card dimensions per grid, 1px hairline borders, layered soft shadows, subtle ambient radial gradients and a faint noise/grid texture. No heavy neon, no gradient-soaked backgrounds, no clutter.
- **Data semantics:** verification statuses use icon + label + color (never color alone).
- Build `/design` (dev-only) as a living style guide showing tokens, type, buttons, badges, cards, charts and states.

### Micro-interactions

Buttons: smooth hover, animated arrow, clear pressed state. Cards: 2–4px lift, border brighten, spotlight glow following the cursor. Nav: animated active-indicator (`layoutId`). Dropdowns/modals: spring transitions. Search: animated selection and clear focus rings. Charts: animated draw-in and filter transitions. Skeletons for all async content.

---

## 6. MOTION SYSTEM

- Central `lib/motion.ts` exporting easings, durations, spring presets, and variants (`fadeUp`, `stagger`, `scaleIn`, `slideIn`). Use them everywhere so motion is consistent.
- Global: page transitions, staggered entrances, scroll-triggered reveals (`whileInView`, once), animated counters, animated navbar indicator, smooth modal/dropdown transitions, animated chart transitions, skeletons.
- Target 60 FPS: animate only `transform` and `opacity`, avoid layout thrash, pause off-screen work (IntersectionObserver), cap canvas DPR, throttle pointer events.
- **`prefers-reduced-motion`:** disable parallax, particles motion, Lenis and large transforms; keep only short opacity fades. Provide a static hero fallback.
- Heavy libraries (GSAP, canvas hero) are loaded with `next/dynamic` only on routes that need them.

**Hero network (canvas):** nodes represent providers and model families; thin connections with subtle pulses; slow ambient drift; mouse-responsive attraction/parallax; on hover a node highlights its neighbours and shows a tooltip (provider or model, with link); on click navigate to the provider/model. Keyboard-accessible alternative: a visually hidden list of the same links. Avoid excessive movement.

---

## 7. ROUTES AND PAGE SPECS

All routes must be fully functional. Consistent navbar (logo, Models, Providers, Compare, Benchmarks, Releases, News, search trigger with ⌘K/Ctrl+K hint, theme toggle, account menu), mobile navigation drawer, breadcrumbs on nested pages, premium footer.

| Route                                                                              | Purpose                     |
| ---------------------------------------------------------------------------------- | --------------------------- |
| `/`                                                                                | Homepage                    |
| `/models`                                                                          | Directory                   |
| `/models/[slug]`                                                                   | Model profile               |
| `/providers`                                                                       | Provider directory          |
| `/providers/[slug]`                                                                | Provider profile            |
| `/compare`                                                                         | Comparison (up to 4 models) |
| `/benchmarks`                                                                      | Benchmark explorer          |
| `/releases`                                                                        | Release timeline            |
| `/news`                                                                            | News and research           |
| `/search`                                                                          | Full search results page    |
| `/about`, `/methodology`, `/sources`, `/contact`, `/privacy`, `/terms`, `/cookies` | Content pages               |
| `/sign-in`, `/sign-up`                                                             | Auth                        |
| `/settings`                                                                        | Preferences                 |
| `/admin/*`                                                                         | Admin (RBAC)                |

### 7.1 Homepage `/`

1. **Hero** (near full-screen): logo, H1 **"Explore the Intelligence Shaping Our Future."**, subtitle **"Discover, compare, and understand the world's most advanced AI models in one place."**, buttons **Explore AI Models** (→ `/models`) and **Compare Models** (→ `/compare`), plus the interactive canvas network and staggered entrance.
2. **Platform statistics:** animated counters from `/api/v1/stats`: total models, providers, models released this month, benchmarks, recently updated models. Demo values, if any, are labelled.
3. **Featured models:** premium grid drawn from the providers listed above; only models that exist in the verified dataset. Card: provider logo, name, family, release date, context window, modalities, pricing (if available), availability, verification badge, link.
4. **Provider overview:** logo, description, model count, link per provider.
5. **Comparison preview:** pick up to 4 models; show context window, pricing, modalities, benchmark results (as separate benchmarks, no blended score), release dates, open-weight status via a compact table and a chart; CTA to `/compare` carrying the selection in the URL.
6. **Latest releases:** editorial timeline (model, provider, date, description, official announcement link).
7. **Latest news:** title, publisher, date, summary, related provider, source link; badges for **Official** vs **Independent** and **AI summary**.
8. **Final CTA:** H2 **"Understand the Models Defining Tomorrow."**, subtitle **"Explore the technology, performance, and capabilities behind modern AI."**, button **Start Exploring**.
9. Footer.

### 7.2 Directory `/models`

- Instant search (name, family, provider, description, capabilities) with suggestions and keyboard navigation.
- Filters (multi-select, collapsible panel, mobile sheet, active-filter chips, clear all):
  - **Provider** (all listed + "Other").
  - **Category:** LLM, reasoning, multimodal, coding, image generation, video generation, audio, embedding.
  - **Capabilities:** text generation, image understanding, image generation, audio understanding, audio generation, video understanding, video generation, tool calling, function calling, code generation, reasoning.
  - **Deployment:** cloud API, hosted service, local deployment, open weights, proprietary.
  - **Pricing:** free, paid, free tier, custom, unknown.
- Sort: recently released, recently updated, alphabetical, provider, context window, individual benchmark score (choose which benchmark). **No overall ranking.**
- Server-side filtering, sorting and pagination; **all state in URL query params** (shareable, back-button safe).
- Card: provider logo, name, family, short description, release date, context window, modalities, pricing, availability, verification badge, **View** and **Add to comparison** buttons. Sticky comparison tray (max 4).
- Empty, loading (skeleton) and error states.

### 7.3 Model profile `/models/[slug]`

Header (provider logo, name, version, family, release date, availability, last updated; actions: **Compare**, **Documentation**, **Share**, **Save**). Sections with sticky in-page nav:

1. **Overview:** purpose, use cases, capabilities, modalities, notable features, known limitations; neutral factual tone.
2. **Technical specifications** (monospace values): context window, max output, input/output modalities, tool calling, structured output, function calling, streaming, knowledge cutoff, training info, architecture, deployment options, API availability. Missing → "Not publicly disclosed".
3. **Pricing:** input, output, cached input, batch, image, audio, other; currency and unit; source and verification date; current vs historical; token cost estimator (input/output/cached tokens → cost, tested).
4. **Capabilities matrix:** reasoning, coding, mathematics, multimodal, long-context, tool use, instruction following, creative writing. Cells show verified benchmark evidence or "No verified data". No invented scores.
5. **Benchmarks:** chart/table toggle; per row benchmark, score, date, methodology, model version, source, evaluation type; note that methodologies differ.
6. **Release history:** vertical timeline (initial release, versions, capability changes, deprecations, pricing changes, docs updates).
7. **Related models:** same provider and similar capabilities.

- Unique metadata and JSON-LD per model. Track "recently viewed".

### 7.4 Providers `/providers`, `/providers/[slug]`

Directory: official name, logo, description, website, HQ (only if verified), organization type, model count, latest announcement. Profile: overview, website, model portfolio (filterable), release timeline visualization, available APIs, supported modalities, research publications, latest announcements.

### 7.5 Compare `/compare`

- Up to 4 models. Selector with instant search, provider and category filters, recently viewed, comparison history.
- Table groups: General (provider, release date, family, availability, open weights), Technical (context, max output, modalities, tool calling, structured output), Performance (reasoning, coding, math, multimodal benchmarks, listed per benchmark), Pricing (input, output, cached, extras), Availability (API, web, local, enterprise). Highlight differences toggle.
- Charts: radar (only over benchmarks with shared, explicitly normalized scale, with a clear note), horizontal bars, pricing, context window, benchmark comparison. Each chart: labels, units, tooltips, source and methodology note, table view, CSV download.
- Shareable URL (`/compare?models=a,b,c`), **CSV export**, save to account, reopen saved comparisons.

### 7.6 Benchmarks `/benchmarks`

Categories: general knowledge, mathematics, coding, logical reasoning, multimodal, instruction following, long-context. Controls: pick benchmarks, filter by provider, family, model version, time range. Visuals: historical performance lines, benchmark comparison bars, score distribution, provider comparison. Every result shows evaluation date, model version, benchmark version, methodology, source, and independent vs provider-reported (badge + icon).

### 7.7 Releases `/releases`

Interactive chronological timeline and list view. Includes major releases, minor updates, deprecations, capability announcements, API changes. Search, date range, provider and category filters. Each entry: date, provider, model, description, official announcement, docs link. Scroll-triggered animation. Only verified releases are shown as confirmed; others carry an "Unconfirmed" badge.

### 7.8 News `/news`

Categories: model releases, research, companies, infrastructure, hardware, safety, regulation. Featured stories, search, filters, pagination. Article: title, summary, publisher, date, source link, category, related provider and models. Official vs independent labelling; AI-summary labelling. Only real, sourced articles.

### 7.9 Global search (⌘K / Ctrl+K)

Command palette (`cmdk`) with instant results across models, providers, benchmarks, releases, news, research. Category filter chips, recent searches, suggestions, highlighted matches, full keyboard navigation, animated selection. Enter on "See all results" opens `/search?q=`.

### 7.10 Settings, personalization

Theme, preferred providers, saved models, saved comparisons, recently viewed, personalized dashboard section. **Anonymous browsing must work**; require sign-in only for saving to an account (anonymous recents/theme may use localStorage).

### 7.11 Footer

Logo, "The Intelligence Standard.", columns **Explore** (Models, Providers, Benchmarks, Comparisons, Releases, News), **Platform** (About, Data methodology, Sources, Contact), **Legal** (Privacy, Terms, Cookies), configured social links (env-driven, hidden if unset), copyright, **Last data update** timestamp from the database. Subtle hover animations.

---

## 8. CHART SYSTEM

Reusable wrappers (`components/charts/*`) around Recharts: `LineChart`, `BarChart`, `RadarChart`, `DistributionChart`, `PricingChart`. Requirements: consistent theme tokens, animated transitions, responsive sizing, interactive tooltips, axis labels and units, source + methodology footnote slot, data download (CSV), **table alternative** and `aria-label` / text summary for screen readers, patterns or markers in addition to color. Every chart must show meaningful data; no decorative charts.

---

## 9. DATA MODEL (Prisma, normalized, with FKs and indexes)

Sourced-record mixin on every factual table: `sourceUrl String?`, `verificationStatus VerificationStatus`, `verifiedAt DateTime?`, `collectedAt DateTime`, `dataType String?`, `isDemo Boolean @default(false)`.

```
Provider        id, name, slug@unique, description, officialWebsite, logoUrl, headquarters?, orgType, created_at, updated_at
Model           id, providerId→Provider, name, slug@unique, family, version?, description, categories[], releaseDate, contextWindow?, maxOutputTokens?,
                openWeights, availability(enum), deployment[], officialDocumentation, knowledgeCutoff?, architecture?, structuredOutput?, streaming?, created_at, updated_at
Capability      id, name@unique, category
ModelCapability modelId, capabilityId, availability(enum), documentationUrl   @@id([modelId, capabilityId])
Pricing         id, modelId, pricingType(enum: INPUT|OUTPUT|CACHED_INPUT|BATCH_INPUT|BATCH_OUTPUT|IMAGE|AUDIO|OTHER), price Decimal, currency, unit,
                effectiveFrom, effectiveTo?, isCurrent, sourceUrl, verifiedAt
Benchmark       id, name, category, description, methodologyUrl, version?
BenchmarkResult id, modelId, benchmarkId, score Decimal, scoreUnit, evaluationDate, modelVersion, benchmarkVersion?, methodologyNotes?,
                evaluationType(enum: INDEPENDENT|PROVIDER_REPORTED|COMMUNITY), sourceUrl
Release         id, modelId?, providerId, kind(enum: MAJOR|MINOR|DEPRECATION|CAPABILITY|API_CHANGE), releaseDate, title, description, announcementUrl, docsUrl?
NewsArticle     id, title, summary, publisher, articleUrl@unique, publicationDate, category(enum), isOfficial, isAiSummary, providerId?, models M:N
Publication     id, providerId, title, url, publishedAt, venue?
User            id, email@unique, name, passwordHash?, role(enum USER|ADMIN), created_at
(Auth.js)       Account, Session, VerificationToken
SavedComparison id, userId, name, configuration Json, created_at
SavedModel, RecentlyViewed, UserPreference
AuditLog        id, actorId, action, entityType, entityId, before Json?, after Json?, ip?, created_at
SyncSource      id, name, kind, config Json, schedule, enabled
SyncRun         id, sourceId, startedAt, finishedAt?, status, recordsSeen, recordsChanged, error?
SyncIssue       id, runId, entityType, message, payload Json    (validation errors)
ImportedRecord  id, runId, entityType, payload Json, diff Json, status(enum PENDING|APPROVED|REJECTED), reviewedBy?, reviewedAt?   (staging area)
```

Indexes: `Model(providerId, releaseDate)`, `Model(slug)`, GIN `tsvector` + `pg_trgm` on names/descriptions, `Pricing(modelId, isCurrent)`, `BenchmarkResult(benchmarkId, modelId, evaluationDate)`, `Release(releaseDate)`, `NewsArticle(publicationDate)`. Provide a seed script (`npm run db:seed`) that loads only validated data per §2.

**Approval flow:** imports land in `ImportedRecord` as `PENDING`; admins review a diff and approve/reject; an import can never overwrite a higher-trust record (`OFFICIALLY_VERIFIED`) with a lower-trust one without explicit admin approval. All approvals and edits write an `AuditLog`.

---

## 10. API (`/api/v1`, REST, Zod-validated, paginated, cached where safe)

```
GET  /stats
GET  /models?q&provider&category&capability&deployment&pricing&sort&benchmark&page&pageSize
GET  /models/:slug            GET /models/:slug/benchmarks|pricing|releases|related
GET  /providers               GET /providers/:slug
GET  /benchmarks              GET /benchmarks/results?benchmark&provider&family&version&from&to
GET  /releases?q&provider&category&from&to&page
GET  /news?q&category&provider&page
GET  /search?q&types
GET  /compare?models=a,b,c,d  GET /compare/export.csv?models=...
POST|GET|DELETE /me/comparisons     GET|PUT /me/preferences     POST|DELETE /me/saved-models
POST /auth/*                  (Auth.js)
/admin/* CRUD for providers, models, pricing, benchmarks, results, releases, news, users
GET|POST /admin/sync/sources|runs|imports|imports/:id/approve|reject
GET  /health
```

Consistent error envelope `{ error: { code, message, details? } }`, cursor or page pagination with total counts, ETag/`Cache-Control` for read endpoints, Redis caching with tag invalidation on writes. Publish OpenAPI at `/api/docs`.

---

## 11. SYNC SYSTEM

Worker service with BullMQ and cron. Jobs: documentation checks, pricing updates, release tracking, benchmark imports, news import. Use official APIs/feeds (RSS, GitHub releases, Hugging Face API, provider changelogs) first. Respect `robots.txt`, terms and rate limits; avoid fragile scraping, and where unavoidable isolate it in a clearly marked adapter with tests. Each adapter: fetch → normalize → validate (Zod) → diff → stage in `ImportedRecord` (see §9). Admin sync dashboard: last run, next scheduled run, successes, failures, validation errors, manual trigger, per-source enable/disable.

---

## 12. AUTH, ADMIN, SECURITY

- Admin at `/admin` behind RBAC (middleware + server-side checks on every admin API). Sections: Overview, Models, Providers, Pricing, Benchmarks, Releases, News, Data Sync, Users, Audit Logs. Admins can add/edit models and providers, update pricing, import benchmark results, publish releases, review sources, approve imports. Validate before publishing; log important changes.
- Security: Zod validation on all inputs, Argon2id, secure httpOnly session cookies, CSRF protection, Redis rate limiting (stricter on auth and admin), security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), safe error messages, parameterized queries only, env validation at boot, no secrets in client bundles, least-privilege DB user, dependency audit in CI. Create the first admin via a documented CLI seed command (never a default password).

---

## 13. QUALITY: ACCESSIBILITY, PERFORMANCE, SEO, TESTING

**Accessibility (WCAG 2.2 AA):** semantic HTML, correct heading hierarchy, full keyboard operation, visible focus rings, ARIA labels, accessible dialogs/menus/tabs (Radix), skip link, sufficient contrast in both themes, no color-only meaning, reduced-motion support, accessible chart alternatives.

**Performance:** SSR/SSG/ISR where fitting (static model pages with revalidation), `next/image`, code splitting, dynamic imports for GSAP/canvas/charts, lazy loading, query optimization (no N+1, select only needed columns), Redis caching, efficient animations. Budget: LCP < 2.5s, CLS < 0.1, INP < 200ms on a mid-range device; check with Lighthouse and report numbers.

**SEO:** unique title and description per page, Open Graph and Twitter cards (dynamic OG images for models/providers), canonical URLs, JSON-LD (Organization, WebSite, `SoftwareApplication` or `Product` for models, `BreadcrumbList`, `Article` for news), `sitemap.xml` (generated from DB), `robots.txt`, clean slugs.

**Testing:**

- Unit (Vitest): filter/sort logic, query-param parsing, pricing and token-cost calculations, verification-status logic, chart data transforms, CSV export, Zod schemas.
- Integration/API/DB: endpoints against a test Postgres (migrations applied), auth, RBAC on every admin route, approval flow never downgrading verified data, audit logging.
- Component (RTL): ModelCard, FilterPanel, CommandPalette, ComparisonTable, VerificationBadge, charts fallbacks.
- E2E (Playwright): browse and filter models with URL persistence, ⌘K search, add 4 models to compare + share URL + CSV download, sign up → save comparison → reopen, admin permission checks, mobile viewport smoke tests, reduced-motion run, axe accessibility scan on key pages.
- CI (GitHub Actions): install, lint, typecheck, unit, integration (service containers), build, Playwright.

---

## 14. PHASES (stop and report after each)

Each phase ends with: passing checks, screenshots reviewed, commit, and a short report (what was built, decisions, open issues, motion values to tune). Then wait for my go-ahead.

**Step 0 — Foundation.** Scaffold the repo and structure below, tooling, Docker Compose (`web`, `worker`, `postgres`, `redis`), env validation, `.env.example`, `CLAUDE.md`, `docs/DECISIONS.md`, CI skeleton. Health check works via `docker compose up`. **Stop.**

**Phase 1 — Brand and design system.** Tokens, both themes, fonts, `Logo` + favicons, motion library, base UI components, navbar (+ mobile), footer, ⌘K shell, `/design` style guide, full homepage with animated canvas hero, counters, and all sections (data may be flagged demo at this stage). _Done when:_ homepage is responsive at 390/768/1440, reduced-motion fallback works, axe scan is clean.

**Phase 2 — Model directory.** Search, filters, sorting, pagination, URL state, model cards, comparison tray, model profile pages (all sections), skeleton/empty/error states. Uses seed data through the repository layer.

**Phase 3 — Backend and database.** Prisma schema and migrations, repositories/services, REST API with OpenAPI, Redis caching, validated seed pipeline with real sourced data per §2 (record sources and gaps in `docs/DATA_STATUS.md`). Replace demo data on Phases 1–2 pages with API data.

**Phase 4 — Comparison.** `/compare`, charts, shareable URLs, CSV export, history, save/reopen (auth-gated part can be stubbed until Phase 9 but must not render as a dead button).

**Phase 5 — Benchmarks.** Explorer, historical/distribution/provider charts, provider-reported vs independent distinction, methodology notes.

**Phase 6 — Providers and releases.** Provider directory and profiles with timelines, `/releases` timeline + list with GSAP scroll effects.

**Phase 7 — News and search.** Editorial section, real sourced articles, AI-summary and official labels, command palette wired to real search, `/search`.

**Phase 8 — Administration.** Admin dashboard, CRUD, audit logs, sync workers, staging/approval flow, sync dashboard.

**Phase 9 — Auth and personalization.** Auth.js, roles, saved models/comparisons, recently viewed, preferences, personalized dashboard, anonymous parity.

**Phase 10 — Production readiness.** Full test suite green, security review checklist, accessibility pass, Lighthouse/Core Web Vitals report, SEO verification, production Dockerfiles, docs.

---

## 15. PROJECT STRUCTURE (adjust if needed, document changes)

```
src/
  app/                      # routes (see §7), api/v1/*, sitemap.ts, robots.ts
  components/{layout,navigation,models,providers,comparison,benchmarks,releases,news,charts,ui}/
  lib/{api,database,validation,authentication,utilities,motion.ts}
  hooks/  types/  styles/
server/{services,repositories,jobs,adapters}/
worker/                     # BullMQ entrypoint
prisma/{schema.prisma,migrations/,seed/data/}
public/{images,icons}/
tests/{unit,integration,e2e}/
docs/{PROMPT.md,DECISIONS.md,DATA_STATUS.md,API.md,DEPLOYMENT.md}
docker/  docker-compose.yml  .env.example  CLAUDE.md
```

---

## 16. DEPLOYMENT NOTES

`docker compose up -d` must run the full stack locally. Document a self-hosted production path: Docker Compose on a Linux VM (e.g. Proxmox), reverse proxy with automatic TLS, or exposure through a **Cloudflare Tunnel**; include backup/restore of Postgres (scheduled `pg_dump` + restore test), log locations, and rollback steps. Keep the app portable (no vendor lock-in); optionally note how to deploy to a managed platform.

---

## 17. FINAL DELIVERABLE AND DEFINITION OF DONE

Complete source code and docs: README (install, env, DB setup, migrations, seeding, running, testing, deployment), `.env.example`, Docker config, API docs, `DATA_STATUS.md` (what is verified, what is demo, what is missing).

The project is done only when:

- All routes in §7 work and every control is functional.
- Data follows §2 with visible verification and source attribution; no fabricated values.
- Typecheck, lint, all test suites and the production build pass; core E2E flows pass.
- Accessibility, reduced-motion, responsive (mobile → desktop) and Core Web Vitals targets are checked and reported.
- The app looks and feels like a premium commercial product, not a template.

---

## FIRST ACTION

Execute **Step 0 only**: confirm the plan in a few lines, scaffold the foundation, create `CLAUDE.md` and `docs/DECISIONS.md`, get `docker compose up` healthy, commit, then **stop and report** before Phase 1.
