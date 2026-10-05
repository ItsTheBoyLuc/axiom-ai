#!/usr/bin/env bash
# Logical backup of the AXIOM AI database (pg_dump, custom format) into ./backups.
#
#   scripts/ops/backup-postgres.sh                 # from the repo root, on the Compose host
#   KEEP_DAYS=30 scripts/ops/backup-postgres.sh    # retention (default 14 days)
#
# The dump is checked with `pg_restore --list` before it is kept, so a truncated or corrupt file
# never replaces a good one, and a SHA-256 is written next to it. Schedule it (docs/DEPLOYMENT.md)
# and copy ./backups OFF the machine: a backup on the same disk is not a backup.
set -Eeuo pipefail

cd "$(dirname "$0")/../.."
COMPOSE="${COMPOSE_CMD:-docker compose}"
KEEP_DAYS="${KEEP_DAYS:-14}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="backups/axiom-${stamp}.dump"

log() { printf '%s backup: %s\n' "$(date -u +%FT%TZ)" "$*"; }
trap 'rm -f "${out}.partial"; log "FAILED"' ERR

mkdir -p backups
log "dumping to ${out}"
# --no-owner: restorable into any cluster; privileges (GRANTs for axiom_app) are kept.
$COMPOSE exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=6 --no-owner' \
  > "${out}.partial"

[ -s "${out}.partial" ] || { log "empty dump"; exit 1; }
$COMPOSE exec -T postgres pg_restore --list < "${out}.partial" > /dev/null
mv "${out}.partial" "${out}"
(cd backups && sha256sum "$(basename "${out}")" > "$(basename "${out}").sha256")
log "ok: $(du -h "${out}" | cut -f1), sha256 $(cut -d' ' -f1 "${out}.sha256")"

find backups -name 'axiom-*.dump' -mtime +"${KEEP_DAYS}" -print -delete \
  | sed 's/^/backup: pruned /' || true
find backups -name 'axiom-*.sha256' -mtime +"${KEEP_DAYS}" -delete || true
