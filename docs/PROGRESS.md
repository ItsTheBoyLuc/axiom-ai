# Progress

Living status of the build. `CLAUDE.md` holds the rules, `docs/PROMPT.md` the spec, `docs/DECISIONS.md` the reasoning. Update this file in the same commit as the work it describes.

## Phases

| Phase | Scope                                              | Status                                  |
| ----- | -------------------------------------------------- | --------------------------------------- |
| 0     | Foundation (Next.js, worker, Compose, CI)          | Done                                    |
| 1     | Brand, design system, homepage                     | Done                                    |
| 2     | Model directory and profiles (demo data)           | Done                                    |
| 3a    | Prisma schema, migrations, REST API, seed pipeline | Done (2026-10-02)                       |
| 3b    | Real, sourced seed data + `docs/DATA_STATUS.md`    | Not started (seed files are still `[]`) |
| 4-10  | Comparison ... hardening and release               | Not started                             |

## Phase 3a verification (2026-10-02)

- Migrations apply to an empty database; `prisma migrate diff` reports no drift.
- Unit 201, integration 206, Playwright 70: all pass (CI e2e caught a search debounce race, fixed in the follow-up commit). Typecheck, lint and production build are clean (the build needs no database).
- Demo seed (`npm run db:seed:demo`) is idempotent: 16 models, 7 providers, 26 prices, 21 benchmark results.
- Full Docker stack: `migrate` exits 0, `web`, `worker`, `postgres`, `redis` healthy, web runs as a non-root user, `/api/v1/health` is ok.
- Prisma overrides reviewed: still required (no fixed 7.x release). See `docs/DECISIONS.md`.

## Next

Phase 3b: fetch and read official sources in-session, then fill `prisma/seed/data/*.json` (unverifiable values stay `null`), record sources and gaps in `docs/DATA_STATUS.md`, and replace demo data on the Phase 1-2 pages with API data.

## Open items

- Redis rate limiting for `/api/v1/*` (hardening phase).
- CI runs integration and Playwright tests since Phase 3a; a Docker image build job is still missing (hardening phase).
- Review the Prisma `overrides` at the start of Phase 10 (hard limit 2026-12-31).
