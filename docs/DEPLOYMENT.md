# Deployment Guide — LIBERTA หัวหิน

Covers deployment of the 7 services that exist today: auth, mfa, guest, room,
booking, admin-service, and the frontend (Stage 1-5, all built with real
Dockerfiles). A single `docker-compose.yml` and `nginx/nginx.conf` wire all 7
live — nothing is commented out. There is no separate prod compose file or
Docker Hub registry step: every image is built from source on the target
machine (VPS or laptop) by `docker compose build`/`up`.

## 1. VPS provisioning

- Ubuntu 22.04 droplet (DigitalOcean or equivalent), 2 vCPU / 4GB RAM minimum
- Open inbound: 22 (SSH), 80, 443 (nginx publishes host ports 8080/8443 by
  default in `docker-compose.yml` — remap to 80/443 in that file for a real
  public deploy, or leave as-is and put another reverse proxy in front).

## 2. Install Docker + Docker Compose

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out/in, then:
docker compose version
```

## 3. Copy project files to the VPS

```bash
mkdir -p /opt/liberta
# from your dev machine:
rsync -avz --exclude node_modules --exclude dist --exclude coverage \
    ./ user@<VPS_IP>:/opt/liberta/
```

## 4. Configure secrets

```bash
cd /opt/liberta
cp .env.example .env
nano .env   # fill in real DB/JWT/internal-service secrets, set SERVER_CN=<VPS_IP>
```

Never commit `.env`. It is already excluded via `.gitignore`.

## 5. TLS certificate

No manual step needed — the `ca` service (see `nginx/ca/`) generates a
self-signed root CA plus a server cert/key for `SERVER_CN` (from `.env`)
automatically the first time `docker compose up` runs, and writes them into
the shared `tls_certs` volume that `nginx` mounts. It re-runs harmlessly on
every subsequent `up` (reuses the existing CA, re-issues the server cert).
`scripts/generate-tls.sh` is superseded and kept only for reference.

This is self-signed — browsers will show a warning. That's expected without a
real domain (out of scope per PROJECT.md; see Future Work below).

## 6. First deploy

```bash
# on the VPS, in /opt/liberta:
bash scripts/deploy.sh
```

`scripts/deploy.sh` builds every image from source and brings the stack up.
On a fresh `mysql_data` volume, MySQL automatically runs `database/schema.sql`
then `database/seed.sql` on first boot only (via `docker-entrypoint-initdb.d`)
— it will NOT re-run them on later deploys. There is no separate migration
tool in this project (out of scope per PROJECT.md); schema changes after the
first boot must be applied manually against the running MySQL container.

## 7. Verify

```bash
docker compose ps      # all should show (healthy)
curl -k https://<VPS_IP>:8443/api/auth/health
curl -k https://<VPS_IP>:8443/api/mfa/health
curl -k https://<VPS_IP>:8443/api/guests/health
curl -k https://<VPS_IP>:8443/api/rooms/health
curl -k https://<VPS_IP>:8443/api/bookings/health
curl -k https://<VPS_IP>:8443/api/admin/health
```

(Use port 443 instead of 8443 if you remapped nginx's ports in step 1.)

## 8. Backups

Set up a daily cron job for MySQL dumps:

```bash
crontab -e
# add:
0 3 * * * /opt/liberta/scripts/backup-db.sh >> /var/log/liberta-backup.log 2>&1
```

Dumps land in `/opt/liberta/backups/`, gzip-compressed, last 14 days retained.

## 9. Redeploying after changes

```bash
cd /opt/liberta
git pull   # or re-rsync updated files
bash scripts/deploy.sh
```

`deploy.sh` rebuilds any image whose source changed and recreates only the
affected containers.

## Troubleshooting

| Symptom | Check |
|---|---|
| `invalid reference format` on `docker compose up` | You're building from source now — `docker-compose.yml` has no `${DOCKERHUB_USER}`-style image references left; make sure you're not passing a stale `--env-file` or a leftover prod compose file. |
| `nginx` container exits immediately | Usually a bad `nginx.conf` — run `docker compose logs nginx`. |
| A service is `(unhealthy)` | `docker compose logs <service>` — check `.env` values and that `mysql`/`redis` are healthy first. |
| 502 from nginx on `/api/...` | The target service container isn't running or crashed — check `docker compose ps`. |
| TLS warning in browser | Expected — self-signed cert, no real domain (see Future Work below). |

## Future Work (explicitly out of scope per PROJECT.md)

- Real payment gateway / PromptPay QR
- Let's Encrypt with a real domain
- CI/CD pipeline
