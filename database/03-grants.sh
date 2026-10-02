#!/bin/bash
# LIBERTA หัวหิน — creates the read-only admin_ro user on a FRESH MySQL volume.
#
# Mounted into /docker-entrypoint-initdb.d/ (see docker-compose.yml), so the
# official mysql image runs it once, right after 01-schema.sql and 02-seed.sql.
# It substitutes ${ADMIN_DB_PASSWORD} into database/grants.sql (mounted at
# /liberta/grants.sql) with plain bash, so no envsubst is needed.
#
# initdb only runs on an empty volume. For an existing volume, or after
# changing ADMIN_DB_PASSWORD, run scripts/apply-grants.sh instead.

if [ -z "${ADMIN_DB_PASSWORD:-}" ]; then
    echo "03-grants.sh: ADMIN_DB_PASSWORD is not set — cannot create admin_ro." >&2
    return 1 2>/dev/null || exit 1
fi

# Escape for a single-quoted SQL string literal: backslash, then single quote.
liberta_bs='\'
liberta_q="'"
liberta_pw="${ADMIN_DB_PASSWORD//"$liberta_bs"/"$liberta_bs$liberta_bs"}"
liberta_pw="${liberta_pw//"$liberta_q"/"$liberta_q$liberta_q"}"

liberta_sql="$(cat /liberta/grants.sql)"
liberta_sql="${liberta_sql//'${ADMIN_DB_PASSWORD}'/"$liberta_pw"}"

echo "03-grants.sh: creating read-only user admin_ro"
printf '%s\n' "$liberta_sql" | mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE:-liberta_hotel}"

unset liberta_bs liberta_q liberta_pw liberta_sql
