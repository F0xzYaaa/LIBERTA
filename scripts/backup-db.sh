#!/usr/bin/env bash
# MySQL backup. Intended for a daily cron job on the VPS:
#   0 3 * * * /opt/liberta/scripts/backup-db.sh >> /var/log/liberta-backup.log 2>&1
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env ]; then
    echo "Missing .env — cannot read MYSQL_ROOT_PASSWORD." >&2
    exit 1
fi

# Explicit ./ prefix — a bare filename is subject to bash's PATH-search `source`
# behavior, which can silently pick up an unrelated file of the same name.
# shellcheck disable=SC1091
source "./.env"

BACKUP_DIR="${BACKUP_DIR:-/opt/liberta/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/liberta_hotel_${TIMESTAMP}.sql.gz"

docker compose -f docker-compose.yml exec -T mysql \
    mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "${MYSQL_DATABASE:-liberta_hotel}" \
    | gzip > "$OUT_FILE"

echo "Backup written to $OUT_FILE"

# Keep the last 14 daily backups, prune older ones.
find "$BACKUP_DIR" -name 'liberta_hotel_*.sql.gz' -mtime +14 -delete
