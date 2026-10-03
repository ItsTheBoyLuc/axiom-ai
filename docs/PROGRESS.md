# Progress

Living status of the build. `CLAUDE.md` holds the rules (including Autopilot mode), `docs/PROMPT.md` the spec, `docs/DECISIONS.md` the reasoning, `docs/DATA_STATUS.md` the data coverage, `docs/MOTION.md` the motion values. Update this file in the same commit as the work it describes.

## Phases

| Phase | Scope                                                         | Status                                                                                                                                                 |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Foundation (Next.js, worker, Compose, CI)                     | Done                                                                                                                                                   |
| 1     | Brand, design system, homepage                                | Done                                                                                                                                                   |
| 2     | Model directory and profiles (demo data)                      | Done                                                                                                                                                   |
| 3a    | Prisma schema, migrations, REST API, seed pipeline            | Done (2026-10-02, CI green)                                                                                                                            |
| 3b    | Real, sourced seed data + `docs/DATA_STATUS.md`               | Data and UI work done 2026-10-03 (all 3 batches loaded, checked, audited, demo removed from pages). **Blocked on the `npm audit` decision**, see below |
| 4-10  | Compare, Benchmarks, Providers, News, Admin, Auth, Production | Not started                                                                                                                                            |

## Phase 3b status

- **Batch 1 (2026-10-02):** 3 providers, 15 models, 77 prices, 67 benchmark results (34 benchmark variants), 21 releases. Self-audit of 8 random records: 0 mismatches (see `docs/DATA_STATUS.md`). Real data loaded into the dev database; screenshots of `/models` and profiles at 1440 and 390 reviewed.
- **Fixed on the way:** reduced-motion hydration error (regression test added), capabilities matrix empty on real data (controlled benchmark categories), hero "DEMO DATA" over real data, long names truncating, monogram "O" looking like a zero, `.dockerignore` and CI gaps from 3a.
- **Batch 2 (2026-10-02):** 4 providers, 11 models, 36 prices, 37 benchmark results, 12 new benchmark variants, 15 releases; every source verified directly (see `docs/DATA_STATUS.md`). Also fixed: card price summary for tiered pricing, and two CI-only e2e flakes (streaming staging element; axe scanning a moving sheet). CI is green on `c86acb7`.
- **Batch 3 (2026-10-03):** 5 providers, 8 models, 9 prices (incl. Nova 2 Lite via a rendered AWS page), 46 benchmark results, 12 releases, 18 news items, 6 publications. Source re-check of every item that was read only through the summarising fetcher, and a self-audit of 8 random records: 0 value mismatches (1 labelling caveat: DataCamp's date is an "Updated" date); see `docs/DATA_STATUS.md`. Loaded into the dev database (34 models, 12 providers, 122 prices, 150 results, 48 releases, 18 news); `/models`, profiles of every new provider and the homepage reviewed at 390/768/1440 (no horizontal overflow, no console errors).
- **Fixed on the way:** cost estimator rejected qualified units (Nova 2 Lite); homepage releases and news were hardcoded demo content (now from the database with source links); a news card repeated the publisher as provider. Demo dataset moved to `prisma/seed/demo/fixtures.ts` (fixtures only).
- **Gates 2026-10-03:** prettier, typecheck, lint, 219 unit, 206 integration, 78 Playwright (axe, both themes), production build, BOM check: all green. `npm audit` (all deps): 5 high, one dev-only chain (`braces`, no patched release); `--omit=dev`: 0. **Waiting for your decision** (options in `docs/DECISIONS.md`, 2026-10-03). Until then the CI audit step fails; every earlier CI step is unaffected.
- **Next step after your decision:** Phase 4 (Compare) per `CLAUDE.md` Autopilot rules.

## Verification log

- Phase 3a (2026-10-02): migrations from empty, 206 integration tests, 70 Playwright tests, production build without a database, full Docker stack healthy and non-root, Prisma overrides reviewed (still required).
- Batch 1: unit tests include `real-seed-data.test.ts` (8) and the search-race tests; Playwright includes `hydration.spec.ts` (6). Run the full gate list before each commit (see Autopilot rules).

## Open items

- Redis rate limiting for `/api/v1/*` (hardening phase).
- CI has no Docker image build job yet (hardening phase).
- Review the Prisma `overrides` at the start of Phase 10 (hard limit 2026-12-31).
- Image-model profiles show "Not publicly disclosed" for inapplicable fields (context window, tool calling).
