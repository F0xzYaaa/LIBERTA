#!/usr/bin/env bash
# SUPERSEDED (2026-09-20) — TLS cert generation now happens automatically in
# the `ca` container (see nginx/ca/, wired into docker-compose.yml and
# docker-compose.prod.yml). It runs once at `docker compose up`, writes
# ca.crt/server.crt/server.key into the shared tls_certs volume, and exits.
#
# No manual step is needed anymore. This script is kept only for reference —
# do not run it against a stack that already has the `ca` service; the certs
# it writes to nginx/certs/ are no longer mounted by nginx (nginx now mounts
# the tls_certs volume instead). See decisions.md 2026-09-20 for the full
# rationale.
set -euo pipefail
echo "generate-tls.sh is superseded by the 'ca' container — see docker-compose.yml." >&2
echo "Nothing to do; exiting without generating anything." >&2
exit 0
