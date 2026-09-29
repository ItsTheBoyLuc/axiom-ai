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
