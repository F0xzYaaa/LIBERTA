# Deployment Guide — LIBERTA หัวหิน

> Placeholder created in Stage 1. Full DigitalOcean VPS deployment guide lands in Stage 6.

## Planned Contents (Stage 6)

1. VPS provisioning (DigitalOcean, Ubuntu 22.04)
2. Docker + Docker Compose installation on VPS
3. Self-signed TLS certificate generation (OpenSSL) — see `nginx/nginx.prod.conf`
4. Pulling images from Docker Hub
5. `.env` setup on VPS (secrets never committed)
6. `docker compose -f docker-compose.prod.yml up -d`
7. Verifying all services are healthy
8. Basic troubleshooting (logs, container restarts, common port conflicts)

## Local Development (available now)

See the root [`README.md`](../README.md) "Setup (Development)" section:

```bash
cp .env.example .env
docker compose up
```
