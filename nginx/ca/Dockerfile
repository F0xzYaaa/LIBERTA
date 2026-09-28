# LIBERTA หัวหิน — one-shot CA/cert generator image.
# Runs entrypoint.sh, writes ca.crt/server.crt/server.key to the mounted
# tls_certs volume, then exits (0). Never listens on a port, never stays up.
FROM alpine:3.20

RUN apk add --no-cache openssl

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
