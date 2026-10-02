#!/usr/bin/env bash
# Creates/updates the read-only admin_ro MySQL user (database/grants.sql) against
# the running mysql container.
#
# A FRESH MySQL volume does not need this: database/03-grants.sh runs from
# docker-entrypoint-initdb.d and creates admin_ro automatically. Run this script
# only for a volume created before that existed, or after ADMIN_DB_PASSWORD
# changes (grants.sql's ALTER USER updates the password).
#
# Safe to run repeatedly: CREATE USER IF NOT EXISTS, ALTER USER and GRANT SELECT
# are all idempotent.
#
# Usage:
#   scripts/apply-grants.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Missing $ENV_FILE — copy .env.example and fill in values first." >&2
    exit 1
fi

# Explicit ./ prefix — a bare filename is subject to bash's PATH-search `source`
# behavior, which can silently pick up an unrelated file of the same name.
# shellcheck disable=SC1090
source "./$ENV_FILE"

if [ -z "${ADMIN_DB_PASSWORD:-}" ]; then
    echo "ADMIN_DB_PASSWORD is not set in $ENV_FILE." >&2
    exit 1
fi

# Substitute the placeholder with plain bash (same escaping as 03-grants.sh) so
# envsubst/gettext-base is not required on the host.
bs='\'
q="'"
pw="${ADMIN_DB_PASSWORD//"$bs"/"$bs$bs"}"
pw="${pw//"$q"/"$q$q"}"
sql="$(cat database/grants.sql)"
sql="${sql//'${ADMIN_DB_PASSWORD}'/"$pw"}"

echo "Applying database/grants.sql (admin_ro read-only user) via $COMPOSE_FILE..."
printf '%s\n' "$sql" \
    | docker compose -f "$COMPOSE_FILE" exec -T mysql \
        mysql -u root -p"$MYSQL_ROOT_PASSWORD" "${MYSQL_DATABASE:-liberta_hotel}"

echo "Done. admin_ro now has SELECT-only access to liberta_hotel."
