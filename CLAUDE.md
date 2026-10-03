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
- Playwright e2e serves the existing production build (`next start`): run `npm run build` first or tests run against stale code. Reveal-on-scroll content is blank in full-page captures until you scroll through the page.
- Full-page screenshots show sticky/fixed elements (navbar, tray) floating mid-page. That is a capture artifact, not a layout bug.
- Data access goes through `server/repositories/*`. Never import the demo dataset from UI code.

## Status

Step 0, Phases 1, 2, 3a and 3b (real sourced data for 12 providers, 34 models) complete. The blocking CI audit is `npm audit --omit=dev` (dev-only `braces` advisory, no upstream fix; revisit by Phase 10, see docs/DECISIONS.md). Phases 4 (Compare) and 5 (Benchmarks) complete. Next: Phase 6 (Providers + releases). Remove the Prisma `overrides` in package.json when a Prisma 7.x release fixes them (see docs/DECISIONS.md).

## Autopilot mode

Saved verbatim from the user's instructions (2026-10-02). These override the "stop and report after each phase" rule in section 1.

### Autopilot rules

Run all remaining phases autonomously and in order (3b, 4, 5, 6, 7, 8, 9, 10) without waiting for my approval between phases; I review only the final result.
Loop per phase: brief plan -> build as specified in docs/PROMPT.md §14 -> run ALL gates -> fix -> commit (Conventional Commits) -> push -> CI green (fix if red) -> update docs/PROGRESS.md and DECISIONS.md -> next phase.
Gates: prettier, typecheck, lint, unit + integration tests, Playwright (incl. axe, both themes), production build, npm audit, BOM check, and screenshots at 390/768/1440 of the touched routes (actually view them and fix what you see).
Stop ONLY if: (a) a gate still fails after a real fix attempt, (b) a decision needs me (credentials, legal, cost, breaking change), or (c) a usage limit. Before stopping, update PROGRESS.md with exactly where you are and the next step, and commit.
Never: disable or weaken tests/CI/audit, add retries to hide flakes, force-push, fabricate data, commit secrets, or change major versions of Next, React, Prisma (^7) or Tailwind without noting it in DECISIONS.md. Never ask me for passwords or tokens in chat.
Commit and push after every batch and every phase so a usage limit never leaves uncommitted work.
Keep a running list of motion values in docs/MOTION.md instead of reporting them per phase.

### Phase 3b: real sourced data, 3 batches by provider

Batch 1: OpenAI, Anthropic, Google DeepMind. Batch 2: Meta, xAI, DeepSeek, Mistral. Batch 3: Microsoft, NVIDIA, Alibaba, Cohere, Amazon, plus news and publications.
Per batch, for each provider: provider record, models, pricing, releases and benchmark results together, so each batch is complete and checkable.
Rules (docs/PROMPT.md §2 and §18 apply in full):

- Determine each provider's CURRENT lineup by fetching official model/pricing/docs pages in this session. Do NOT use memory for model names, versions, dates, prices, specs or scores; your training data is out of date.
- Every record has sourceUrl, verificationStatus, verifiedAt (today), collectedAt. Unverifiable -> null / NOT_PUBLICLY_DISCLOSED. Descriptions in your own words; no long copied text.
- Pricing: currency, unit, effectiveFrom, isCurrent. Benchmarks: only scores readable in an official model card/announcement or an independent leaderboard, with evaluationType, benchmark + model version, date, URL. No invented or converted scores.
- News: only real articles you fetched, with publisher, date and URL. Mark AI-written summaries as such.
- Run the seed validation, load into Postgres, update docs/DATA_STATUS.md (verified, missing, why).
- After each batch: check /models, a profile and /api/v1/stats in the browser via Playwright, and fix UI issues that real data exposes (long names, missing fields, empty sections).
- After batch 1: self-audit. Pick 8 random records across tables, re-fetch their sourceUrl, and confirm the stored values match. Write the result in DATA_STATUS.md and fix any mismatch.
- After batch 3: remove demo data from the Phase 1-2 pages (homepage, directory, profiles). Demo rows remain only as test fixtures with SEED_DEMO=true. The DEMO DATA badge must still work for fixtures.

### Later phases (details in docs/PROMPT.md §14)

4 Compare, 5 Benchmarks, 6 Providers + releases (incl. GSAP scroll effects), 7 News + global search (palette wired to real search), 8 Admin (RBAC, CRUD, audit logs, sync worker with official APIs/feeds only, respecting robots.txt and rate limits, network mocked in tests; staging + approval flow that can never downgrade verified data; sync dashboard), 9 Auth + personalization (Auth.js; first admin via `npm run admin:create`, which generates a random password and writes it to a git-ignored local file, never printed in chat, logs or commits; saving comparisons gets enabled here), 10 Production readiness (full tests, security checklist incl. CSP, a11y pass, Lighthouse/Core Web Vitals numbers, SEO, production Docker/compose, README, API.md, DEPLOYMENT.md with Compose on a Linux VM, Cloudflare Tunnel and Postgres backup/restore, final DATA_STATUS.md).

### Final report (when all phases are done)

What is built, how to run it (exact PowerShell commands), what is verified vs. missing in the data, the 10 records you are least sure about, known issues, decisions that need my review, and the docs/MOTION.md values.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
