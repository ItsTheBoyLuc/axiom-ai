# Seed data

Real, sourced data goes here as JSON arrays (one file per entity). Phase 3b fills these files.

Rules (docs/PROMPT.md section 2), enforced by `prisma/seed/schemas.ts` and by CHECK constraints in the database:

- Every record has `collectedAt`, `verificationStatus`, `sourceUrl`, `verifiedAt`, `isDemo`.
- A record **without** a `sourceUrl` is rejected unless its status is `UNVERIFIED` or `NOT_PUBLICLY_DISCLOSED`.
- `OFFICIALLY_VERIFIED` and `INDEPENDENTLY_EVALUATED` records must also have `verifiedAt`.
- `isDemo: true` is rejected in these files. Demo fixtures live in `prisma/seed/demo/` and load only with `SEED_DEMO=true`.
- A value that cannot be verified is `null`, never a guess.
- Cross references use slugs (`provider`, `model`, `benchmark`).

Commands: `npm run db:seed` (this directory only) and `npm run db:seed:demo` (also the fictional demo fixtures).
