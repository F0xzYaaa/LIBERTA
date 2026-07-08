#!/usr/bin/env bash
# Creates/updates the read-only admin_ro MySQL user (database/grants.sql) against
# the running mysql container. Not part of docker-entrypoint-initdb.d because that
# mechanism runs .sql files verbatim — it does not substitute the ${ADMIN_DB_PASSWORD}
# placeholder grants.sql uses, so this script does the substitution instead.
#
# Safe to run repeatedly: CREATE USER IF NOT EXISTS + repeated GRANT SELECT are
# both idempotent. Run once after the first `docker compose up -d mysql`, and again
# any time ADMIN_DB_PASSWORD changes.
#
# Usage:
#   scripts/apply-grants.sh              # dev — docker-compose.yml + .env
#   scripts/apply-grants.sh prod         # prod — docker-compose.prod.yml + .env.prod
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

MODE="${1:-dev}"
if [ "$MODE" = "prod" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    ENV_FILE=".env.prod"
else
    COMPOSE_FILE="docker-compose.yml"
    ENV_FILE=".env"
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "Missing $ENV_FILE — copy $(basename "$ENV_FILE").example and fill in values first." >&2
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

echo "Applying database/grants.sql (admin_ro read-only user) via $COMPOSE_FILE..."
ADMIN_DB_PASSWORD="$ADMIN_DB_PASSWORD" envsubst '${ADMIN_DB_PASSWORD}' < database/grants.sql \
    | docker compose -f "$COMPOSE_FILE" exec -T mysql \
        mysql -u root -p"$MYSQL_ROOT_PASSWORD" "${MYSQL_DATABASE:-liberta_hotel}"

echo "Done. admin_ro now has SELECT-only access to liberta_hotel."
