#!/usr/bin/env bash
# Replaces the LIVE database with a backup. Destructive: everything written since the backup is
# lost. Stops web and worker, drops and recreates the database, restores, starts them again.
#
#   scripts/ops/restore-postgres.sh backups/axiom-<stamp>.dump --yes
#
# Take a fresh backup first if the current data matters, and run restore-test-postgres.sh on the
# same file beforehand.
set -Eeuo pipefail

cd "$(dirname "$0")/../.."
COMPOSE="${COMPOSE_CMD:-docker compose}"
dump="${1:-}"
[ -n "${dump}" ] && [ -f "${dump}" ] || { echo "usage: $0 <dump file> --yes" >&2; exit 2; }
[ "${2:-}" = "--yes" ] || { echo "refusing without --yes: this replaces the live database" >&2; exit 2; }

log() { printf '%s restore: %s\n' "$(date -u +%FT%TZ)" "$*"; }

if [ -f "${dump}.sha256" ]; then
  (cd "$(dirname "${dump}")" && sha256sum -c "$(basename "${dump}").sha256" > /dev/null) \
    || { log "checksum mismatch, aborting"; exit 1; }
fi
$COMPOSE exec -T postgres pg_restore --list < "${dump}" > /dev/null || { log "not a valid dump"; exit 1; }

log "stopping web and worker"
$COMPOSE stop web worker
log "recreating the database"
$COMPOSE exec -T postgres sh -c '
  dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" &&
  createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
log "restoring ${dump}"
$COMPOSE exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < "${dump}"
# The app role needs its grants on the restored tables (they are in the dump, this is a safety net).
$COMPOSE exec -T postgres sh -c '
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -c "
    GRANT USAGE ON SCHEMA public TO axiom_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO axiom_app;"'
log "starting web and worker"
$COMPOSE up -d --wait web worker
log "done"
