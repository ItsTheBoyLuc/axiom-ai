#!/usr/bin/env bash
# Proves the newest backup actually restores: loads it into a throw-away database next to the live
# one and compares row counts of the main tables. Never touches the live database. Run it after
# every backup change and on a schedule (an untested backup is a hope, not a backup).
#
#   scripts/ops/restore-test-postgres.sh [backups/axiom-<stamp>.dump]
set -Eeuo pipefail

cd "$(dirname "$0")/../.."
COMPOSE="${COMPOSE_CMD:-docker compose}"
dump="${1:-$(ls -1t backups/axiom-*.dump 2>/dev/null | head -1)}"
[ -n "${dump}" ] && [ -f "${dump}" ] || { echo "restore-test: no dump found in ./backups" >&2; exit 1; }
scratch="axiom_restore_test"
tables=("Provider" "Model" "Pricing" "BenchmarkResult" "Release" "NewsArticle" "User" "AuditLog")

log() { printf '%s restore-test: %s\n' "$(date -u +%FT%TZ)" "$*"; }
sql() { $COMPOSE exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d $1 -At -c \"$2\""; }
cleanup() { $COMPOSE exec -T postgres sh -c "dropdb -U \"\$POSTGRES_USER\" --if-exists ${scratch}" > /dev/null 2>&1 || true; }
trap cleanup EXIT

if [ -f "${dump}.sha256" ]; then
  (cd "$(dirname "${dump}")" && sha256sum -c "$(basename "${dump}").sha256" > /dev/null) \
    && log "checksum ok" || { log "CHECKSUM MISMATCH"; exit 1; }
fi

log "restoring ${dump} into ${scratch}"
cleanup
$COMPOSE exec -T postgres sh -c "createdb -U \"\$POSTGRES_USER\" ${scratch}"
$COMPOSE exec -T postgres sh -c \
  "pg_restore -U \"\$POSTGRES_USER\" -d ${scratch} --no-owner --exit-on-error" < "${dump}"

live_db="$($COMPOSE exec -T postgres sh -c 'printf %s "$POSTGRES_DB"')"
status=0
for t in "${tables[@]}"; do
  live="$(sql "${live_db}" "select count(*) from \\\"${t}\\\"")"
  copy="$(sql "${scratch}" "select count(*) from \\\"${t}\\\"")"
  if [ "${live}" = "${copy}" ]; then
    log "  ${t}: ${copy} rows (matches live)"
  else
    # Rows written after the backup was taken legitimately differ; a restore COPY with MORE rows
    # than live would not be. Report it, do not fail on live > copy.
    log "  ${t}: live ${live}, restored ${copy}"
    [ "${copy}" -le "${live}" ] || status=1
  fi
done
[ "${status}" -eq 0 ] && log "OK" || { log "FAILED: restored data does not look right"; exit 1; }
