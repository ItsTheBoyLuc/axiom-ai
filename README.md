# AXIOM AI

**The Intelligence Standard.** A directory, benchmark explorer and comparison tool for AI models, where every fact carries its source, its verification status and the date it was checked. There is no overall score and no global ranking: benchmarks are never blended.

- Models, providers, pricing, benchmarks, releases, news and research, with search (`Ctrl+K`) and side-by-side comparison of up to four models.
- Optional accounts: saved models and comparisons, preferred providers, a personalised start page. Everything works without an account.
- Admin area with CRUD, audit log, and a data-sync pipeline (RSS/Atom, GitHub releases, Hugging Face) that stages imports for approval and can never silently lower the trust of verified data.
- Public read API with OpenAPI, rate limits and caching.

Quality rules live in `CLAUDE.md` (working rules, data integrity). The full specification is `docs/PROMPT.md`.

## Stack

Next.js (App Router, React, TypeScript strict) · Tailwind with CSS-variable tokens · Radix UI, cmdk, Lucide · Motion (GSAP and Lenis only on the hero and `/releases`) · Recharts behind `components/charts` · PostgreSQL 16 + Prisma 7 · Redis (cache, rate limits, BullMQ) · a separate `worker` service · custom DB sessions with Argon2id (see `docs/DECISIONS.md` for why not Auth.js) · Vitest, Testing Library, Playwright with axe · Docker multi-stage (non-root) + Compose · GitHub Actions.

## Requirements

Node.js 22+, Docker with Compose, Git. Windows 11, macOS and Linux work; examples are PowerShell.

## Quick start

```powershell
Copy-Item .env.example .env
# Edit .env: set POSTGRES_PASSWORD and APP_DB_PASSWORD, and make DATABASE_URL use the same password.
npm install
docker compose up -d postgres redis      # databases for local development
npm run db:deploy                        # apply migrations
npm run db:seed                          # load the verified catalogue (idempotent)
npm run dev                              # http://localhost:3000
```

The whole stack in containers (what production runs, minus TLS):

```powershell
docker compose up -d --build --wait
docker compose ps                        # web, worker, postgres, redis healthy; migrate exited 0
Invoke-RestMethod http://localhost:3000/api/v1/health
docker compose run --rm migrate npm run db:seed
```

`docker compose down` keeps your data; `docker compose down -v` deletes the volumes (the database).

### The first administrator

There is no default account and no default password. Create one with a generated password that is written to a file, never printed:

```powershell
npm run admin:create -- --email you@example.com      # writes .admin-credentials.local (git-ignored)
```

Sign in at `/sign-in`, read the password from that file once, store it in a password manager, delete the file. In containers see `docs/DEPLOYMENT.md`.

## Configuration

All configuration is environment variables, validated at boot (`src/lib/env.ts`). Copy `.env.example`, which documents every variable.

| Variable                               | Purpose                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `APP_URL`                              | Public URL. `https://` turns on Secure cookies, HSTS and upgrade-insecure-requests |
| `DATABASE_URL`, `REDIS_URL`            | Connections used by `npm run dev`, tests and the CLI on the host                   |
| `POSTGRES_*`, `APP_DB_PASSWORD`        | Compose: database owner, and the least-privilege role web and worker use           |
| `CLIENT_IP_HEADER`                     | Header the reverse proxy sets with the client address (rate limiting)              |
| `API_RATE_LIMIT_PER_MINUTE`            | Public API budget per address (default 240, 0 disables)                            |
| `CONTACT_EMAIL`                        | Shown on `/contact` and in the privacy notice                                      |
| `GITHUB_TOKEN`                         | Optional, raises the GitHub API limit of the sync adapter                          |
| `NEXT_PUBLIC_SOCIAL_*`                 | Optional footer links (read at build time)                                         |
| `WEB_PORT`, `WEB_BIND`, `TUNNEL_TOKEN` | Compose: published port, interface, Cloudflare Tunnel                              |

## Database

Prisma schema in `prisma/schema.prisma`, migrations in `prisma/migrations` (CHECK constraints enforce the data-integrity rules in the database too).

```powershell
npm run db:migrate           # create a migration while developing
npm run db:deploy            # apply migrations (what production runs)
npm run db:status
npm run db:seed              # real, sourced catalogue from prisma/seed/data/*.json (Zod-validated)
npm run db:seed:demo         # also load the fictional demo fixtures (tests only, never in production)
```

Seed records without a `sourceUrl` are rejected unless their status is `NOT_PUBLICLY_DISCLOSED` or `UNVERIFIED`. Where the data came from and what is missing: `docs/DATA_STATUS.md`.

## Testing and quality gates

```powershell
npm run format:check; npm run lint; npm run typecheck
npm test                     # unit and component tests (Vitest)
npm run test:integration     # API and database tests against a separate test database
npm run build
npm run test:e2e             # Playwright, incl. axe in both themes, on the production build
npm audit --omit=dev --audit-level=high
```

Integration and end-to-end tests use their own databases (`axiom_test`, `axiom_e2e`) on the development server and refuse to touch the development database. `npm run test:e2e` serves the existing production build, so run `npm run build` first. CI (`.github/workflows/ci.yml`) runs all of the above plus a Docker job that builds the images, boots the stack the way production does and proves a backup restores.

## Project layout

```text
src/app            routes (App Router), API route handlers under api/v1
src/components     presentation; src/lib shared logic, schemas, motion tokens
server/            services, repositories (all data access), auth, admin, jobs, adapters
worker/            BullMQ worker entry (scheduler, sync jobs)
prisma/            schema, migrations, seed pipeline and data
scripts/           admin-create, API doc generator, ops/ (backup and restore)
docker/            Dockerfile (web, worker, migrate targets), initdb (least-privilege role)
tests/             unit, integration, e2e
docs/              PROMPT, DECISIONS, PROGRESS, DATA_STATUS, MOTION, SECURITY, API, DEPLOYMENT
```

## Documentation

| Doc                   | What it is                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `docs/DEPLOYMENT.md`  | Compose on a Linux VM, Cloudflare Tunnel or Caddy, backups and the restore test, updates and rollback |
| `docs/SECURITY.md`    | Review of the custom auth, headers, rate limits, deployment hardening, known limitations              |
| `docs/API.md`         | Public read API (generated from the endpoint registry), account and admin endpoints                   |
| `docs/DATA_STATUS.md` | What data is verified, demo or missing, and why                                                       |
| `docs/DECISIONS.md`   | Every non-obvious decision and deviation, with reasons                                                |
| `docs/PROGRESS.md`    | Build log per phase, with the gates that passed                                                       |
| `docs/MOTION.md`      | All motion values, for tuning                                                                         |
| `docs/PROMPT.md`      | The full specification                                                                                |

The running app also serves its API reference at `/api/docs` and the OpenAPI document at `/api/docs/openapi.json`.

## License and data

No license file is included yet: choose one before publishing the code. The catalogue contains facts collected from public pages with links back to each source; model and company names belong to their owners. AXIOM AI is independent and not affiliated with any provider.
