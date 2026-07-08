# Deployment Guide — LIBERTA หัวหิน

Covers production deployment of the 5 services that exist today (auth, mfa,
guest, room, booking). **admin-service and the frontend are not built yet**
(Stage 4 / Stage 5) — the compose file and nginx config have their blocks
commented out until then. Do not uncomment them before those services have
real Dockerfiles.

## 1. VPS provisioning

- Ubuntu 22.04 droplet (DigitalOcean or equivalent), 2 vCPU / 4GB RAM minimum
- Open inbound: 22 (SSH), 80, 443. Everything else stays behind the firewall.

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
cp .env.prod.example .env.prod
nano .env.prod   # fill in real DOCKERHUB_USER, DB/JWT secrets, VPS_IP
```

Never commit `.env.prod`. It is already excluded via `.gitignore`.

## 5. Generate the TLS certificate

```bash
export VPS_IP=<your VPS IP>
bash scripts/generate-tls.sh
```

This is self-signed — browsers will show a warning. That's expected without a
real domain (out of scope per PROJECT.md; see docs/DEPLOYMENT.md#future-work).

## 6. Build and push images (from your dev machine)

```bash
export DOCKERHUB_USER=yourdockerhubuser
export TAG=$(git rev-parse --short HEAD)

for svc in auth mfa guest room booking; do
    docker build -t $DOCKERHUB_USER/liberta-$svc:$TAG \
                  -t $DOCKERHUB_USER/liberta-$svc:latest \
                  services/${svc}-service
    docker push $DOCKERHUB_USER/liberta-$svc:$TAG
    docker push $DOCKERHUB_USER/liberta-$svc:latest
done
```

## 7. First deploy

```bash
# on the VPS, in /opt/liberta:
bash scripts/deploy.sh
```

`scripts/deploy.sh` pulls the images and brings the stack up. On a fresh
`mysql_data` volume, MySQL automatically runs `database/schema.sql` then
`database/seed.sql` on first boot only (via `docker-entrypoint-initdb.d`) — it
will NOT re-run them on later deploys. There is no separate migration tool in
this project (out of scope per PROJECT.md); schema changes after the first
boot must be applied manually against the running MySQL container.

## 8. Verify

```bash
docker compose -f docker-compose.prod.yml ps      # all should show (healthy)
curl -k https://<VPS_IP>/api/auth/health
curl -k https://<VPS_IP>/api/mfa/health
curl -k https://<VPS_IP>/api/guests/health
curl -k https://<VPS_IP>/api/rooms/health
```

Note: `booking-service` has no `/health` endpoint yet, so it has no Docker
healthcheck wired in `docker-compose.prod.yml` either — see the TODO comment
there. Verify it's up with `docker compose logs booking-service` instead.

## 9. Backups

Set up a daily cron job for MySQL dumps:

```bash
crontab -e
# add:
0 3 * * * /opt/liberta/scripts/backup-db.sh >> /var/log/liberta-backup.log 2>&1
```

Dumps land in `/opt/liberta/backups/`, gzip-compressed, last 14 days retained.

## 10. Redeploying after changes

Repeat step 6 (build/push with a new `TAG`), then on the VPS:

```bash
cd /opt/liberta
export TAG=<new tag>
bash scripts/deploy.sh
```

## Rollback

```bash
export TAG=<previous known-good tag>
bash scripts/deploy.sh
```

Since every image is tagged with its git short SHA (step 6), rolling back is
just re-deploying an older tag — no rebuild needed.

## Troubleshooting

| Symptom | Check |
|---|---|
| `nginx` container exits immediately | Usually a bad `nginx.prod.conf` — run `docker compose logs nginx`. If it references a commented-out service (admin/frontend), that's expected until Stage 4/5. |
| A service is `(unhealthy)` | `docker compose logs <service>` — check `.env.prod` values and that `mysql`/`redis` are healthy first. |
| 502 from nginx on `/api/...` | The target service container isn't running or crashed — check `docker compose ps`. |
| TLS warning in browser | Expected — self-signed cert, no real domain (see Future Work below). |

## Future Work (explicitly out of scope per PROJECT.md)

- Real payment gateway / PromptPay QR
- Let's Encrypt with a real domain
- CI/CD pipeline
- admin-service + frontend once Stage 4/5 land — uncomment their blocks in
  `docker-compose.prod.yml` and `nginx/nginx.prod.conf`, add their Dockerfiles,
  rebuild/push, redeploy.
