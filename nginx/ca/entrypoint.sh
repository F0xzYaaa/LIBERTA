#!/bin/sh
# LIBERTA หัวหิน — one-shot CA/cert generator.
#
# Creates a self-signed root CA (once — reused across restarts if already
# present in the tls_certs volume) and a server cert/key for nginx signed by
# that CA, then exits. Safe to re-run: only regenerates the server cert
# (365-day validity), never the CA itself, unless CA_FORCE_REGEN=1.
set -eu

OUT_DIR="${OUT_DIR:-/certs}"
CN="${SERVER_CN:-localhost}"
CA_DAYS="${CA_DAYS:-3650}"
SERVER_DAYS="${SERVER_DAYS:-365}"

mkdir -p "$OUT_DIR"
cd "$OUT_DIR"

if [ ! -f ca.key ] || [ ! -f ca.crt ] || [ "${CA_FORCE_REGEN:-0}" = "1" ]; then
    echo "Generating root CA (valid ${CA_DAYS} days)..."
    openssl req -x509 -nodes -days "$CA_DAYS" -newkey rsa:4096 \
        -keyout ca.key -out ca.crt \
        -subj "/C=TH/ST=Prachuap Khiri Khan/L=Hua Hin/O=LIBERTA/CN=LIBERTA Internal Root CA"
    chmod 600 ca.key
    chmod 644 ca.crt
else
    echo "Existing root CA found, reusing it."
fi

echo "Issuing server cert for CN=$CN (valid ${SERVER_DAYS} days)..."
openssl req -nodes -newkey rsa:2048 \
    -keyout server.key -out server.csr \
    -subj "/C=TH/ST=Prachuap Khiri Khan/L=Hua Hin/O=LIBERTA/CN=$CN"

cat > server.ext <<EOF
subjectAltName = DNS:$CN, DNS:localhost, IP:127.0.0.1
extendedKeyUsage = serverAuth
EOF

openssl x509 -req -days "$SERVER_DAYS" \
    -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
    -extfile server.ext -out server.crt

rm -f server.csr server.ext
chmod 600 server.key
chmod 644 server.crt

echo "Done. Wrote to $OUT_DIR: ca.crt, server.crt, server.key"
