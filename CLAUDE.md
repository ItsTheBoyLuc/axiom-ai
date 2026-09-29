# AXIOM AI - project instructions

> **Source of truth:** `docs/PROMPT.md` holds the full master prompt (all specs, routes, data model, API, phases). Read it before starting any phase. If this file and the prompt disagree, the prompt wins unless `docs/DECISIONS.md` records an override. The sections below are a condensed working summary.

Premium web platform for discovering, researching, benchmarking and comparing AI models. Tagline: "The Intelligence Standard." Quality bar: Linear / Vercel / Stripe. Not a template.

## 1. Operating rules

1. Plan before code; keep the todo list current.
2. Work in phases (0-10). Finish, verify, commit, then **stop and report**. Never skip ahead.
3. Verify: typecheck, lint, unit tests, build, run the app. Use Playwright screenshots at 1440px and 390px for UI phases. List motion values chosen so the user can tune them.
4. No dead UI: every visible control works, otherwise don't render it.
5. Conventional Commits. Never commit secrets. Keep `.env.example` in sync.
6. Update this file when a decision changes; log decisions in `docs/DECISIONS.md`.
7. Ask only when blocked; otherwise pick the conventional option and record it.
8. Windows 11 host: cross-platform npm scripts, LF line endings, PowerShell for shell examples.
   **All files must be UTF-8 without BOM.** Windows PowerShell 5.1 `Set-Content`/`Out-File -Encoding utf8` adds a BOM, which has already broken the CSS build and polluted `.env`. Create and edit files with the Write/Edit tools (or Bash `sed`), never PowerShell 5.1 `Set-Content`; if unavoidable, use `[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding $false))`. Check with `grep -rlI $'^\xEF\xBB\xBF' --exclude-dir=node_modules --exclude-dir=.next .`.
9. Small files. Business logic in `server/` and `src/lib/`, presentation in `src/components/`.

## 2. Data integrity (non-negotiable)

- Never seed model facts from memory. Only from sources fetched and read in-session (official docs, pricing pages, model cards, papers, independent benchmark orgs).
- Every sourced record: `sourceUrl`, `verificationStatus`, `verifiedAt`, `collectedAt`, `isDemo`.
- `verificationStatus`: `OFFICIALLY_VERIFIED`, `INDEPENDENTLY_EVALUATED`, `PROVIDER_REPORTED`, `COMMUNITY_REPORTED`, `UNVERIFIED`, `NOT_PUBLICLY_DISCLOSED`.
- Unverifiable value => `null`, rendered as "Not publicly disclosed". Never guess or interpolate.
- Placeholder/demo data: `isDemo = true`, visible **DEMO DATA** badge, never mixed silently with verified data.
- Seed JSON in `prisma/seed/data/*.json`, validated by Zod; reject records without `sourceUrl` unless status is `NOT_PUBLICLY_DISCLOSED`/`UNVERIFIED`.
- No overall score or global ranking. Never blend incompatible benchmarks. Always show benchmark name/version, methodology, date, model version, source, independent vs provider-reported.
- Pricing stores currency, unit, effective dates, `isCurrent`, source, verification date; history is kept and labelled.
- Imports never overwrite higher-trust data without explicit admin approval (staging in `ImportedRecord`, audit log).
- AI-generated news summaries are labelled; official vs independent is visually distinct.

## 3. Stack (locked; change only with a DECISIONS.md note)

Next.js App Router + React + TS strict; Tailwind with CSS-variable tokens; Geist Sans/Mono; Radix UI, cmdk, Lucide; Motion for React (+ GSAP/ScrollTrigger only for hero and /releases, dynamic import; Lenis); canvas 2D hero; Recharts wrapped in `components/charts`; Route Handlers under `/api/v1/*` with Zod + OpenAPI at `/api/docs`; PostgreSQL 16 + Prisma (pg_trgm, tsvector); Redis (cache, rate limit, BullMQ); separate `worker` service; Auth.js v5 (Argon2id, optional GitHub, DB sessions, USER/ADMIN); Vitest, RTL, Playwright; Docker multi-stage non-root + Compose (`web`, `worker`, `postgres`, `redis`); ESLint, Prettier, Husky + lint-staged.

## 4. Design tokens (dark default)

`--bg-primary #08090C`, `--bg-secondary #0D0F14`, `--bg-elevated #12151C`, `--bg-card #151821`, `--accent #5685FF`, `--accent-2 #43D9F5`, `--accent-3 #9B7BFF`, `--text #F5F7FA`, `--text-2 #A0A7B7`, `--text-muted #747D90`, `--border rgba(255,255,255,.08)`, `--border-strong rgba(255,255,255,.14)`. Matching light theme (WCAG AA), toggle system/dark/light, no flash. Only animate `transform`/`opacity`; honour `prefers-reduced-motion`. Central `src/lib/motion.ts`.

## 5. Commands (PowerShell)

```powershell
npm run dev          # Next dev server (needs postgres/redis: docker compose up -d postgres redis)
npm run worker       # BullMQ worker on the host
npm run lint; npm run typecheck; npm test; npm run build
docker compose up -d --build     # full stack; health: http://localhost:3000/api/v1/health
docker compose ps                # all services should be "healthy"
docker compose down -v           # stop and wipe volumes
```

## Layout

`src/{app,components,lib,hooks,types,styles}`, `server/{services,repositories,jobs,adapters}`, `worker/`, `prisma/`, `tests/{unit,integration,e2e}`, `docs/`, `docker/`.

## Gotchas (learned the hard way)

- Card/list grids: always set `grid-cols-1` on the base breakpoint. An implicit `auto` track expands to min-content and overflows narrow screens.
- Do not put `inline-flex` (or any `display` utility) in a shared class string that is also combined with `hidden` / `lg:hidden`; the order in the CSS decides and the control leaks onto the wrong breakpoints.
- Only animate transform/opacity, and wait for animations and pending transitions before axe scans or screenshots (dimmed/fading UI blends colours).
- Playwright: use `gotoReady()` from `tests/e2e/helpers.ts` (waits for hydration); scope locators (`getByRole('combobox', { name })`, `main header`), since selects also have the combobox role.
- Full-page screenshots show sticky/fixed elements (navbar, tray) floating mid-page. That is a capture artifact, not a layout bug.
- Data access goes through `server/repositories/*`. Never import the demo dataset from UI code.

## Status

Step 0, Phase 1 and Phase 2 (model directory + profiles on demo data through the repository layer) complete. Next: Phase 3 (Prisma schema, migrations, REST API + OpenAPI, Redis cache, sourced seed data) after user go-ahead. Remove the Prisma `overrides` in package.json when a Prisma 7.x release fixes them (see docs/DECISIONS.md).
