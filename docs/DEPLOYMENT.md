# Deployment

Self-hosted production path: **Docker Compose on a Linux VM** (for example an Ubuntu 24.04 LTS VM on Proxmox), reached through a **Cloudflare Tunnel** (no inbound ports) or a TLS reverse proxy, with scheduled **Postgres backups and a tested restore**. Nothing here ties the app to a vendor: it is four containers and a database.

Everything below was run end to end on 2026-10-05 against a fresh Compose project (build, health, seed, backup, restore test, destructive restore). The commands are the ones that were run.

## What runs

| Service       | Image target                     | Role                                                                                                                           |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `web`         | `docker/Dockerfile` target `web` | Next.js (standalone), port 3000 inside, published on `127.0.0.1` only                                                          |
| `worker`      | target `worker`                  | BullMQ scheduler and sync jobs, health on 3001 (internal)                                                                      |
| `migrate`     | target `migrate`                 | One-shot: `prisma migrate deploy`. Also runs the seed and `admin:create`. The only service that connects as the database owner |
| `postgres`    | `postgres:16-alpine`             | Data volume `pgdata`; first start creates the least-privilege role `axiom_app` (`docker/initdb`)                               |
| `redis`       | `redis:7-alpine`                 | Cache, rate limits and job queue; append-only file on volume `redisdata`                                                       |
| `cloudflared` | optional, profile `tunnel`       | Outbound tunnel to Cloudflare                                                                                                  |

Web and worker run as non-root, read-only, with all capabilities dropped, and connect to the database as `axiom_app` (SELECT, INSERT, UPDATE, DELETE only).

## 1. Prepare the VM

Ubuntu 24.04 LTS, 2 vCPU, 4 GB RAM, 20 GB disk is comfortable. Install Docker Engine and the Compose plugin from Docker's official apt repository, then:

```bash
sudo usermod -aG docker "$USER"            # log out and in again
sudo apt-get install -y git curl
```

Cap container log growth (otherwise logs fill the disk): `/etc/docker/daemon.json`

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "5" } }
```

```bash
sudo systemctl restart docker
```

Firewall: with a Cloudflare Tunnel you need **no inbound ports** except SSH from your own network. With a reverse proxy on the VM, allow 80 and 443. Never publish 5432, 6379 or 3000 to the internet.

```bash
sudo ufw default deny incoming && sudo ufw allow OpenSSH && sudo ufw enable
```

## 2. Get the code and configure

```bash
git clone https://github.com/ItsTheBoyLuc/axiom-ai.git /opt/axiom-ai && cd /opt/axiom-ai
cp .env.example .env
chmod 600 .env
```

Edit `.env`. Generate strong values (do not reuse the placeholders):

```bash
openssl rand -base64 33   # run twice: POSTGRES_PASSWORD and APP_DB_PASSWORD
```

| Variable                    | Set to                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                   | The public URL, **with `https://`** (turns on `Secure` cookies, `__Host-` prefix, HSTS, `upgrade-insecure-requests`) |
| `POSTGRES_PASSWORD`         | Owner password (migrations, seed, backups)                                                                           |
| `APP_DB_PASSWORD`           | Password of the `axiom_app` role the web and worker use                                                              |
| `WEB_PORT`, `WEB_BIND`      | Keep `WEB_BIND=127.0.0.1`. Change the port only if 3000 is taken                                                     |
| `CLIENT_IP_HEADER`          | `cf-connecting-ip` behind Cloudflare; empty (`x-forwarded-for`) behind Caddy or nginx                                |
| `CONTACT_EMAIL`             | Public contact address shown on `/contact` and in the privacy notice                                                 |
| `TUNNEL_TOKEN`              | Cloudflare Tunnel token (see section 4)                                                                              |
| `API_RATE_LIMIT_PER_MINUTE` | Optional; default 240 per address                                                                                    |
| `GITHUB_TOKEN`              | Optional; raises the GitHub API limit of the sync adapter                                                            |
| `ENABLE_DEBUG_OVERLAY`      | Leave **unset** in production. `true` allows the `?debug=scroll` overlay on `/` (scroll and frame statistics)        |

`NEXT_PUBLIC_SOCIAL_*` are read at build time; set them before `docker compose build`.

## 3. First start

```bash
docker compose up -d --build --wait      # builds, migrates, starts, waits for healthy
docker compose ps                        # web, worker, postgres, redis healthy; migrate exited 0
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Load the verified dataset and create the first administrator. The password is generated, written to a file you mount (mode 600) and never printed; the command refuses to start, before touching the database, if it cannot write the file:

```bash
docker compose run --rm migrate npm run db:seed

mkdir -p secrets && chmod 700 secrets          # /secrets/ is git-ignored and docker-ignored
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/secrets:/secrets"   migrate npm run admin:create -- --email you@example.com --out /secrets/admin.txt
cat secrets/admin.txt                          # read it once, put it in your password manager,
shred -u secrets/admin.txt                     # then destroy the file
```

Lost it? Run the same command again with `--rotate` (it also signs the admin out everywhere).

The seed is idempotent and refuses to lower the trust of existing records. `SEED_DEMO` must stay unset in production (demo data is for tests).

**Existing Postgres volume** (created before the `axiom_app` role existed): the init script only runs on an empty volume. Run it once by hand, then restart web and worker:

```bash
docker compose exec -T postgres sh < docker/initdb/01-app-role.sh      # idempotent; also rotates the role's password to APP_DB_PASSWORD
docker compose up -d web worker
```

## 4. Cloudflare Tunnel (recommended)

The VM makes an outbound connection to Cloudflare; nothing listens on the internet, and TLS is terminated by Cloudflare.

1. In the Cloudflare dashboard: **Zero Trust, Networks, Tunnels, Create a tunnel** (type Cloudflared). Copy the tunnel token.
2. Add a **public hostname** (for example `axiom.example.com`) with service type **HTTP** and URL `http://web:3000` (the Compose service name; the tunnel container joins the same Compose network).
3. In `.env`: `TUNNEL_TOKEN=…`, `APP_URL=https://axiom.example.com`, `CLIENT_IP_HEADER=cf-connecting-ip`.
4. Start it: `docker compose --profile tunnel up -d` (restart `web` and `worker` after changing `APP_URL`: `docker compose up -d web worker`).
5. **Protect the admin area.** In Zero Trust, **Access, Applications**, add a self-hosted application for `axiom.example.com/admin*` (and `/api/v1/admin*`) with a policy that allows only you. This adds multi-factor authentication in front of the admin login, which the app itself does not have (see `docs/SECURITY.md`).
6. Pin the `cloudflared` image to a version tag in `docker-compose.yml` instead of `latest`.

Because the tunnel connects to `web` over the Compose network, `WEB_BIND=127.0.0.1` can stay: the host port is only for local checks.

### Alternative: reverse proxy with automatic TLS (Caddy)

Run Caddy on the VM (ports 80 and 443) and keep the app on loopback:

```caddyfile
axiom.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Caddy sets `X-Forwarded-For`, so leave `CLIENT_IP_HEADER` empty, and set `APP_URL=https://axiom.example.com`. Do not add a second proxy that lets clients set `X-Forwarded-For` themselves.

## 5. Backups and the restore test

Logical backups with `pg_dump` (custom format), verified on creation, with a checksum, retention and pruning:

```bash
scripts/ops/backup-postgres.sh                 # writes backups/axiom-<UTC stamp>.dump and .sha256
KEEP_DAYS=30 scripts/ops/backup-postgres.sh
scripts/ops/restore-test-postgres.sh           # restores the newest dump into a throw-away database and compares row counts
```

`restore-test-postgres.sh` never touches the live database. It checks the checksum, restores into `axiom_restore_test`, compares the row counts of the main tables with the live ones, and drops the scratch database. Result of the run on 2026-10-05 (seeded data plus one account):

```text
Provider: 12 rows (matches live)      Model: 34       Pricing: 122    BenchmarkResult: 150
Release: 48                           NewsArticle: 18 User: 1         AuditLog: 1        -> OK
```

**Schedule it** (daily at 02:30, restore test weekly), as the deploy user:

```bash
( crontab -l 2>/dev/null; cat <<'CRON'
30 2 * * * cd /opt/axiom-ai && scripts/ops/backup-postgres.sh >> /var/log/axiom-backup.log 2>&1
45 2 * * 0 cd /opt/axiom-ai && scripts/ops/restore-test-postgres.sh >> /var/log/axiom-backup.log 2>&1
CRON
) | crontab -
sudo touch /var/log/axiom-backup.log && sudo chown "$USER" /var/log/axiom-backup.log
```

**Copy `backups/` off the machine.** A backup on the same disk is not a backup. Any of these works: `restic` or `rclone` to object storage, `rsync` to another host, or Proxmox's own VM backups as a second layer. Encrypt anything that leaves the host (the dump contains password hashes and email addresses).

### Restoring (destructive)

This replaces the live database. Stop, restore, start; everything written after the backup is lost.

```bash
scripts/ops/restore-test-postgres.sh backups/axiom-<stamp>.dump        # prove the file first
scripts/ops/restore-postgres.sh backups/axiom-<stamp>.dump --yes
```

It verifies the checksum, stops web and worker, recreates the database, restores, re-grants the app role and starts the services again. Tested on 2026-10-05: an account created after the backup was gone afterwards, the one from before was present, and the app signed up a new account as `axiom_app` right after.

Restoring to a **new** server: install Docker, clone, create `.env` with the same passwords, `docker compose up -d postgres redis` (first start creates `axiom_app`), copy the dump over, run `restore-postgres.sh`, then `docker compose up -d --build --wait`.

## 6. Logs, health and monitoring

- Logs: `docker compose logs -f web worker`, `docker compose logs --since 1h web`. They are JSON-file logs rotated by the Docker daemon settings above, under `/var/lib/docker/containers/`. The app writes errors and operational messages to stdout only; it does not log request bodies, credentials or email addresses. Administrative changes are in the database audit log (`/admin/audit`).
- Health: `GET /api/v1/health` (Postgres and Redis) for the web container; the worker exposes its own on 3001 (used by the container health check). Point an uptime monitor at the **public** `/api/v1/health`.
- Sync worker status is on `/admin/sync` ("worker online" heartbeat).
- Resource view: `docker stats --no-stream`.

## 7. Updating and rolling back

```bash
cd /opt/axiom-ai
scripts/ops/backup-postgres.sh             # always first: migrations are forward-only
git fetch --tags && git checkout <tag-or-commit>
docker compose up -d --build --wait        # migrate runs first; web and worker follow
curl -fsS http://127.0.0.1:3000/api/v1/health
```

**Rollback.** Code only (no migration in between): `git checkout <previous tag>` and the same `up -d --build --wait`. If the update included a migration, the previous code may not run against the new schema: check out the previous tag, then `scripts/ops/restore-postgres.sh backups/<backup taken in step 1> --yes`. Keep the pre-update backup until you are happy. Tag every release (`git tag -a v1.0.0 -m …`) so there is something to go back to.

## 8. Operational notes

- **Egress:** the sync worker fetches external feeds. Besides its own SSRF guard, restrict its outbound traffic to the sources you configured (host firewall or a Docker network with an egress proxy), and keep it off internal address ranges.
- **Secrets:** `.env` is the only place; mode 600, never committed (`.gitignore`). Rotate `APP_DB_PASSWORD` by editing `.env`, re-running `docker/initdb/01-app-role.sh` and `docker compose up -d web worker`.
- **Time:** keep the VM clock correct (chrony); session expiry and rate limits use it.
- **Disk:** `pgdata` and `redisdata` are Docker volumes. `docker compose down` keeps them; `down -v` **deletes the database**.
- **Admin access:** administrators are created only with the CLI above. Prefer Cloudflare Access in front of `/admin`.
- **Managed platforms (optional):** the app is portable. It needs PostgreSQL 16 with `pg_trgm`, Redis, and two long-running Node processes (web and worker) from the same image targets. On a PaaS, run `npx prisma migrate deploy` as the release command and set the same environment variables (`DATABASE_URL`, `REDIS_URL`, `APP_URL`, `CLIENT_IP_HEADER`, `CONTACT_EMAIL`); use a database role without DDL rights for the running processes as `docker/initdb/01-app-role.sh` does.

## Local development on Windows

```powershell
Copy-Item .env.example .env          # set POSTGRES_PASSWORD, APP_DB_PASSWORD and DATABASE_URL to match
docker compose up -d postgres redis
npm install
npm run db:deploy; npm run db:seed
npm run dev
```

Full stack locally: `docker compose up -d --build` (web on `http://localhost:3000`, or `WEB_PORT` from `.env`). Tests: `npm run lint; npm run typecheck; npm test; npm run test:integration; npm run build; npm run test:e2e`.
