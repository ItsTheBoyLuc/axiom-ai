# Progress

Living status of the build. `CLAUDE.md` holds the rules (including Autopilot mode), `docs/PROMPT.md` the spec, `docs/DECISIONS.md` the reasoning, `docs/DATA_STATUS.md` the data coverage, `docs/MOTION.md` the motion values. Update this file in the same commit as the work it describes.

## Phases

| Phase | Scope                                                         | Status                                                                                                                                              |
| ----- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation (Next.js, worker, Compose, CI)                     | Done                                                                                                                                                |
| 1     | Brand, design system, homepage                                | Done                                                                                                                                                |
| 2     | Model directory and profiles (demo data)                      | Done                                                                                                                                                |
| 3a    | Prisma schema, migrations, REST API, seed pipeline            | Done (2026-10-02, CI green)                                                                                                                         |
| 3b    | Real, sourced seed data + `docs/DATA_STATUS.md`               | Batches 1 and 2 done and pushed. Batch 3 data written and validated, NOT loaded, NOT UI-checked, NOT fully verified (stopped on request 2026-10-02) |
| 4-10  | Compare, Benchmarks, Providers, News, Admin, Auth, Production | Not started                                                                                                                                         |

## Phase 3b status

- **Batch 1 (2026-10-02):** 3 providers, 15 models, 77 prices, 67 benchmark results (34 benchmark variants), 21 releases. Self-audit of 8 random records: 0 mismatches (see `docs/DATA_STATUS.md`). Real data loaded into the dev database; screenshots of `/models` and profiles at 1440 and 390 reviewed.
- **Fixed on the way:** reduced-motion hydration error (regression test added), capabilities matrix empty on real data (controlled benchmark categories), hero "DEMO DATA" over real data, long names truncating, monogram "O" looking like a zero, `.dockerignore` and CI gaps from 3a.
- **Batch 2 (2026-10-02):** 4 providers, 11 models, 36 prices, 37 benchmark results, 12 new benchmark variants, 15 releases; every source verified directly (see `docs/DATA_STATUS.md`). Also fixed: card price summary for tiered pricing, and two CI-only e2e flakes (streaming staging element; axe scanning a moving sheet). CI is green on `c86acb7`.
- **STOPPED ON REQUEST (2026-10-02, ~20:40 UTC).** Everything is committed and pushed. Exact state of batch 3: the 8 JSON files in `prisma/seed/data/` contain batch 3 (Microsoft, NVIDIA, Alibaba, Cohere, Amazon, 18 news items, 6 publications) and pass `tests/unit/real-seed-data.test.ts`; see `docs/DATA_STATUS.md` ("Batch 3") for what is verified, what is not, and the known gaps.
- **Next steps, in order (nothing below has been started):**
  1. Re-check in the browser the batch 3 items listed under "Read only through the summarising fetcher" in `docs/DATA_STATUS.md`; fix anything that does not match; add a short verification paragraph.
  2. Load into the dev database (`npm run db:seed` after truncating, see earlier commands), rebuild, and check `/models`, one profile per new provider and `/api/v1/stats` with screenshots at 390, 768 and 1440; fix UI problems the data exposes.
  3. Run all gates (prettier, typecheck, lint, unit, integration, Playwright with axe in both themes, build, audit, BOM check), commit, push, confirm CI is green.
  4. Remove demo data from the homepage (hardcoded `lib/demo-data` news and releases), directory and profiles; demo rows stay only as `SEED_DEMO=true` fixtures with a working DEMO DATA badge. News and publications now exist as real data to feed the homepage.
  5. Then Phase 4 (Compare) per `CLAUDE.md` Autopilot rules.
- **Needs your decision when you are back:** Muse Spark 1.3 (no official release date: wait, or allow a null release date); whether to keep Amazon Nova 2 Lite without a price.

## Verification log

- Phase 3a (2026-10-02): migrations from empty, 206 integration tests, 70 Playwright tests, production build without a database, full Docker stack healthy and non-root, Prisma overrides reviewed (still required).
- Batch 1: unit tests include `real-seed-data.test.ts` (8) and the search-race tests; Playwright includes `hydration.spec.ts` (6). Run the full gate list before each commit (see Autopilot rules).

## Open items

- Redis rate limiting for `/api/v1/*` (hardening phase).
- CI has no Docker image build job yet (hardening phase).
- Review the Prisma `overrides` at the start of Phase 10 (hard limit 2026-12-31).
- The homepage still imports hardcoded demo news and releases from `lib/demo-data` (batch 3 / Phase 7).
- Image-model profiles show "Not publicly disclosed" for inapplicable fields (context window, tool calling).
