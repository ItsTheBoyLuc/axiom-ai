#!/bin/sh
# Creates the least-privilege role the running app uses (web and worker). Runs once, when the
# postgres data volume is first initialised (docker-entrypoint-initdb.d).
#
#   axiom (owner)      : applies migrations and runs the seed / admin:create; never used by web.
#   axiom_app (this)   : SELECT, INSERT, UPDATE, DELETE on every table the owner creates, now or
#                        later. No DDL, no TRUNCATE, no superuser, cannot create roles or databases.
#
# Existing volume? Run this file by hand once:
#   docker compose exec -T postgres sh < docker/initdb/01-app-role.sh
# (needs APP_DB_PASSWORD in the container environment, see docker-compose.yml)
set -eu
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set}"
psql -v ON_ERROR_STOP=1 -v pw="$APP_DB_PASSWORD" -v owner="$POSTGRES_USER" -v db="$POSTGRES_DB" \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'axiom_app') AS create_role \gset
\if :create_role
  CREATE ROLE axiom_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'pw';
\else
  ALTER ROLE axiom_app PASSWORD :'pw';
\endif
GRANT CONNECT ON DATABASE :"db" TO axiom_app;
GRANT USAGE ON SCHEMA public TO axiom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO axiom_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO axiom_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO axiom_app;
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO axiom_app;
SQL
