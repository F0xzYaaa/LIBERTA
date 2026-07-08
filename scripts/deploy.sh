#!/usr/bin/env bash
# Run on the VPS from /opt/liberta. Pulls the latest images and restarts the
# stack. Safe to run repeatedly — docker compose only recreates containers
# whose image/config actually changed.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env.prod ]; then
    echo "Missing .env.prod — copy .env.prod.example and fill in real secrets first." >&2
    exit 1
fi

if [ ! -f nginx/certs/server.crt ]; then
    echo "No TLS cert found — run scripts/generate-tls.sh first." >&2
    exit 1
fi

echo "Pulling latest images..."
docker compose -f docker-compose.prod.yml --env-file .env.prod pull

echo "Recreating changed containers..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo "Waiting for mysql to report healthy before applying grants..."
until [ "$(docker compose -f docker-compose.prod.yml ps -q mysql | xargs docker inspect -f '{{.State.Health.Status}}')" = "healthy" ]; do
    sleep 2
done
"$(dirname "${BASH_SOURCE[0]}")/apply-grants.sh" prod

echo "Waiting for services to report healthy..."
sleep 5
docker compose -f docker-compose.prod.yml ps

echo "Done. Check the table above — every service should show (healthy)."
