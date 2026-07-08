#!/usr/bin/env bash
# Generate a self-signed TLS cert for the VPS IP. Safe to run twice — overwrites
# any existing cert/key with a fresh 365-day pair.
set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/nginx/certs"
mkdir -p "$CERT_DIR"

VPS_IP="${VPS_IP:-127.0.0.1}"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -subj "/C=TH/ST=Bangkok/L=Hua Hin/O=LIBERTA/CN=$VPS_IP"

chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"

echo "Self-signed cert generated for $VPS_IP"
echo "  $CERT_DIR/server.crt"
echo "  $CERT_DIR/server.key"
