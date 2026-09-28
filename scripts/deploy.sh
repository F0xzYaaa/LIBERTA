#!/usr/bin/env bash
# Run on the VPS from /opt/liberta. Pulls the latest images and restarts the
# stack. Safe to run repeatedly — docker compose only recreates containers
# whose image/config actually changed.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env ]; then
    echo "Missing .env — copy .env.example and fill in real secrets first." >&2
    exit 1
fi

# TLS certs are generated automatically by the `ca` container as part of the
# `up` below (writes into the tls_certs volume) — no manual pre-flight check
# needed anymore.

echo "Building images..."
docker compose -f docker-compose.yml build

echo "Recreating changed containers..."
docker compose -f docker-compose.yml up -d

echo "Waiting for mysql to report healthy before applying grants..."
until [ "$(docker compose -f docker-compose.yml ps -q mysql | xargs docker inspect -f '{{.State.Health.Status}}')" = "healthy" ]; do
    sleep 2
done
"$(dirname "${BASH_SOURCE[0]}")/apply-grants.sh"

echo "Waiting for services to report healthy..."
sleep 5
docker compose -f docker-compose.yml ps

echo "Done. Check the table above — every service should show (healthy)."
