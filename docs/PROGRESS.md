# Progress

Living status of the build. `CLAUDE.md` holds the rules (including Autopilot mode), `docs/PROMPT.md` the spec, `docs/DECISIONS.md` the reasoning, `docs/DATA_STATUS.md` the data coverage, `docs/MOTION.md` the motion values. Update this file in the same commit as the work it describes.

## Phases

| Phase | Scope                                                         | Status                                                                  |
| ----- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 0     | Foundation (Next.js, worker, Compose, CI)                     | Done                                                                    |
| 1     | Brand, design system, homepage                                | Done                                                                    |
| 2     | Model directory and profiles (demo data)                      | Done                                                                    |
| 3a    | Prisma schema, migrations, REST API, seed pipeline            | Done (2026-10-02, CI green)                                             |
| 3b    | Real, sourced seed data + `docs/DATA_STATUS.md`               | Batch 1 done (OpenAI, Anthropic, Google DeepMind). Batches 2 and 3 next |
| 4-10  | Compare, Benchmarks, Providers, News, Admin, Auth, Production | Not started                                                             |

## Phase 3b status

- **Batch 1 (2026-10-02):** 3 providers, 15 models, 77 prices, 67 benchmark results (34 benchmark variants), 21 releases. Self-audit of 8 random records: 0 mismatches (see `docs/DATA_STATUS.md`). Real data loaded into the dev database; screenshots of `/models` and profiles at 1440 and 390 reviewed.
- **Fixed on the way:** reduced-motion hydration error (regression test added), capabilities matrix empty on real data (controlled benchmark categories), hero "DEMO DATA" over real data, long names truncating, monogram "O" looking like a zero, `.dockerignore` and CI gaps from 3a.
- **Next:** batch 2 = Meta, xAI, DeepSeek, Mistral (provider, models, pricing, releases, benchmark results together; read every source in-session; validate with `npx vitest run tests/unit/real-seed-data.test.ts`; reseed with `npm run db:seed`; check `/models`, a profile and `/api/v1/stats` with Playwright; update `DATA_STATUS.md`; commit and push). Then batch 3 = Microsoft, NVIDIA, Alibaba, Cohere, Amazon plus news and publications, then remove demo data from the homepage, directory and profiles (demo rows stay only as `SEED_DEMO=true` test fixtures).

## Verification log

- Phase 3a (2026-10-02): migrations from empty, 206 integration tests, 70 Playwright tests, production build without a database, full Docker stack healthy and non-root, Prisma overrides reviewed (still required).
- Batch 1: unit tests include `real-seed-data.test.ts` (8) and the search-race tests; Playwright includes `hydration.spec.ts` (6). Run the full gate list before each commit (see Autopilot rules).

## Open items

- Redis rate limiting for `/api/v1/*` (hardening phase).
- CI has no Docker image build job yet (hardening phase).
- Review the Prisma `overrides` at the start of Phase 10 (hard limit 2026-12-31).
- The homepage still imports hardcoded demo news and releases from `lib/demo-data` (batch 3 / Phase 7).
- Image-model profiles show "Not publicly disclosed" for inapplicable fields (context window, tool calling).
