<div align="center">

# LIBERTA HUAHIN

**Hotel Management System for a boutique hotel in Hua Hin, Thailand**

Microservices · NestJS · React · MySQL · Redis · Docker

![Node](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-TypeScript-E0234E?logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

</div>

---

## Table of Contents

1. [About](#about)
2. [What you need](#what-you-need)
3. [Quick start (run it on your own computer)](#quick-start-run-it-on-your-own-computer)
4. [Deploy to a server (VPS)](#deploy-to-a-server-vps)
5. [First login and how to use it](#first-login-and-how-to-use-it)
6. [Configuration reference](#configuration-reference)
7. [Daily operations](#daily-operations)
8. [Troubleshooting](#troubleshooting)
9. [Architecture](#architecture)
10. [Project structure](#project-structure)
11. [Testing](#testing)

## About

LIBERTA HUAHIN is a hotel booking and management system. Guests browse rooms and request a booking on a public website. Staff and admins confirm payments and manage rooms in a protected admin panel that uses two-factor login.

There is no payment gateway. A guest pays outside the system, staff check the payment slip and press **Confirm Payment**, and the booking changes from **Draft** to **Reserved**.

**Guest site:** room listing, light registration (no password), draft booking held for 15 minutes, booking lookup by reference number.

**Admin panel:** two-factor login, bookings and payment confirmation, rooms and room types, employee management, dashboard (summary, occupancy, revenue).

## What you need

| Requirement | Notes |
|---|---|
| Docker with Compose v2 | [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows/macOS, Docker Engine on Linux |
| Git | to download the project |
| Free port **443** | Nginx serves HTTPS here. Stop anything else that uses 443 |
| Free ports 3001-3006, 3306, 5173, 6379 | published by the default compose file |
| About 4 GB RAM and 5 GB disk | for the images and database |

You do **not** need to install Node.js, MySQL or Redis. Everything runs in containers.

## Quick start (run it on your own computer)

**1. Download the project**

```bash
git clone https://github.com/F0xzYaaa/LIBERTA.git liberta
cd liberta
```

**2. Create your config file**

```bash
cp .env.example .env
```

Open `.env` in a text editor and change at least these values:

| Variable | What to set |
|---|---|
| `MYSQL_ROOT_PASSWORD` and `DB_PASSWORD` | the same strong password |
| `ADMIN_DB_PASSWORD` | another strong password |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | two long random strings (32+ characters) |
| `INTERNAL_SERVICE_KEY` | a random string of 32+ characters |

Generate a random secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# or, without Node:
openssl rand -hex 32
```

**3. Start everything**

```bash
docker compose up -d --build
```

The first run builds all images and takes several minutes. MySQL loads the database schema and sample data by itself on its first start.

**4. Create the read-only dashboard database user (one time)**

```bash
bash scripts/apply-grants.sh
```

Run it from Git Bash or WSL on Windows, or any shell on Linux/macOS. It needs `envsubst` (package `gettext-base` on Ubuntu). Run it again whenever you change `ADMIN_DB_PASSWORD`.

**5. Restart Nginx once** so it finds all services:

```bash
docker compose restart nginx
```

**6. Open the site**

- Guest site: **https://localhost/**
- Admin panel: **https://localhost/admin/login**

Your browser will warn that the certificate is not trusted. That is expected, because the certificate is self-signed. Choose *Advanced* and continue.

**7. Check that all containers are running**

```bash
docker compose ps
```

Every service should show `Up`, and `mysql` and `redis` should show `healthy`.

## Deploy to a server (VPS)

Tested layout: an Ubuntu 22.04 server (DigitalOcean or similar) with 2 vCPU and 4 GB RAM.

**1. Prepare the server**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # log out and back in afterwards
docker compose version             # confirm Compose v2 is installed
```

**2. Open the firewall**

Only SSH and HTTPS should be reachable from the internet:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

> The default `docker-compose.yml` also publishes the service ports (3001-3006, 3306, 5173, 6379) for development. Docker bypasses `ufw` for published ports, so on a public server remove those `ports:` lines from every service except `nginx` before you start it. Nginx reaches the services over the internal Docker network and does not need them.

**3. Get the project onto the server**

```bash
git clone https://github.com/F0xzYaaa/LIBERTA.git /opt/liberta
cd /opt/liberta
```

**4. Configure**

```bash
cp .env.example .env
nano .env
```

Set strong secrets as in the quick start, and set the certificate name to your server:

```
SERVER_CN=203.0.113.10        # your server's public IP or domain name
```

**5. Start**

```bash
docker compose up -d --build
bash scripts/apply-grants.sh
docker compose restart nginx
```

**6. Verify**

```bash
docker compose ps
curl -k https://<SERVER_IP>/api/room-types
```

Then open `https://<SERVER_IP>/` in a browser.

**HTTPS certificate.** A small one-shot container named `ca` creates a root CA and a server certificate for `SERVER_CN` on the first start and stores them in a Docker volume. You do not have to run any OpenSSL command. The certificate is self-signed, so browsers show a warning. To remove the warning you need a real domain and a certificate from a public CA, which this project does not set up.

## First login and how to use it

**Sample accounts (created by the seed data, for testing only):**

| Username | Password | Role |
|---|---|---|
| `admin` | `password123` | Admin |
| `staff01` | `password123` | Staff |
| `staff02` | `password123` | Staff |

> Change these before any real use. Log in as an admin, create your own employees under the employee management page, then deactivate the sample accounts.

**Two-factor login.** Go to `/admin/login`, enter the username and password, then:

1. First time: the page shows a QR code. Scan it with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy). Save the backup codes that are shown once.
2. Every later login: enter the 6-digit code from the app.

**Confirm a guest booking (Draft to Reserved):**

1. A guest books on the public site and receives a reference such as `BK-2026-000012`. The draft is held for 15 minutes.
2. The guest pays outside the system and sends you the slip.
3. In the admin panel open **Bookings**, click the Draft booking, and find the **Confirm Payment** card.
4. Enter a payment note (required), attach the slip image (optional), and press **Confirm Payment**.

## Configuration reference

All settings live in one file, `.env`, in the project root. Never commit it. The template is [`.env.example`](.env.example).

| Variable | Purpose |
|---|---|
| `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD` | database password (must match each other) |
| `ADMIN_DB_USERNAME`, `ADMIN_DB_PASSWORD` | read-only database user used by the dashboard |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | secrets that sign login tokens |
| `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES` | token lifetimes (default 24h) |
| `INTERNAL_SERVICE_KEY` | shared key between auth-service and mfa-service |
| `TOTP_ISSUER` | name shown in the authenticator app |
| `BOOKING_DRAFT_LOCK_MINUTES` | how long a draft booking is held (default 15) |
| `BOOKING_SLIP_MAX_SIZE_BYTES` | maximum payment slip size (default 5 MB) |
| `SERVER_CN` | name on the HTTPS certificate: `localhost`, your IP, or your domain |

> **Important:** editing `.env` does not change containers that are already running. Apply changes with:
> ```bash
> docker compose up -d --force-recreate
> docker compose restart nginx
> ```
> MySQL sets its root password only when its data volume is first created. If you change `MYSQL_ROOT_PASSWORD` afterwards, also change it inside MySQL, or the services will fail with `Access denied for user 'root'`.

## Daily operations

```bash
docker compose ps                     # status of all containers
docker compose logs -f auth-service   # follow one service's logs
docker compose restart nginx          # re-resolve services after a recreate
docker compose down                   # stop everything (data is kept)
```

**Update to a newer version**

```bash
git pull
docker compose up -d --build
docker compose restart nginx
```

**Back up the database** (add to `crontab -e` for a daily 03:00 backup):

```bash
0 3 * * * /opt/liberta/scripts/backup-db.sh >> /var/log/liberta-backup.log 2>&1
```

Backups are compressed SQL dumps in `/opt/liberta/backups`, and the last 14 are kept.

**Start with a fresh database.** This deletes all data:

```bash
docker compose down -v
docker compose up -d --build
bash scripts/apply-grants.sh
```

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Site shows `502 Bad Gateway` | Nginx has an old address for a recreated container. Run `docker compose restart nginx`. |
| Services keep restarting, log says `Access denied for user 'root'` | The password in `.env` differs from the one stored in the MySQL volume. Change the MySQL password to match `.env`, or use `docker compose down -v` for a fresh start. |
| `nginx` will not start, `port is already allocated` | Another program uses port 443. Stop it, or change `"443:443"` in `docker-compose.yml` to another host port such as `"8443:443"` and browse to `https://localhost:8443/`. |
| Certificate warning in the browser | Expected with a self-signed certificate. Continue past the warning. |
| Admin dashboard shows errors | The read-only user is missing. Run `bash scripts/apply-grants.sh`. |
| Cannot open the site from another device | Check the firewall allows 443 and that you use the server address, not `localhost`. Set `SERVER_CN` to that address. |
| Login says too many attempts (429) | Too many failed logins for that account. Wait 15 minutes. |
| Lost the authenticator app | An admin can reset a user's MFA on the employee management page. If the only admin lost theirs, reset in the database: `DELETE FROM BackupCode; DELETE FROM MFASecret; UPDATE Employee SET mfa_enabled = 0;` |
| `.env` change has no effect | Recreate the containers, see the note in the configuration section. |

## Architecture

```
Browser (guest + staff/admin)
        |  HTTPS :443
      Nginx  -- reverse proxy, TLS, rate limiting
        |  internal Docker network
  auth   mfa   guest   room   booking   admin
  3001   3002  3003    3004   3005      3006
        \      |       |       /
         MySQL 8          Redis 7
        (persistent)   (temp tokens, draft lock)
```

| Service | Port | Responsibility |
|---|---|---|
| auth-service | 3001 | login, JWT, employee management |
| mfa-service | 3002 | TOTP enrollment, QR codes, backup codes |
| guest-service | 3003 | guest registration |
| room-service | 3004 | rooms, room types, images |
| booking-service | 3005 | draft bookings, 15-minute lock, payment confirmation |
| admin-service | 3006 | read-only dashboard queries |
| frontend | 5173 | React app |
| ca | - | one-shot certificate generator |

**Built with:** Node.js, NestJS, TypeScript, TypeORM, MySQL 8, Redis 7, React 18, Vite, Tailwind CSS, JWT, bcrypt, otplib (TOTP), Nginx, Docker Compose.

Ready-made images are also published on Docker Hub as `pxisdaw/liberta-<service>` (auth, mfa, guest, room, booking, admin, frontend, ca). The compose file builds from source, so you need the repository either way, because it also supplies the database scripts and Nginx config.

## Project structure

```
.
├── backend/
│   ├── auth-service/
│   ├── mfa-service/
│   ├── guest-service/
│   ├── room-service/
│   ├── booking-service/
│   └── admin-service/
├── frontend/               # React + Vite app (guest site and /admin)
├── nginx/
│   ├── nginx.conf          # reverse proxy, TLS, rate limits
│   └── ca/                 # one-shot certificate generator
├── database/
│   ├── schema.sql          # 10 tables
│   ├── seed.sql            # sample data
│   └── grants.sql          # read-only dashboard user
├── scripts/                # apply-grants, backup-db, deploy
├── docs/                   # ARCHITECTURE, API, DEPLOYMENT
├── docker-compose.yml
└── .env.example
```

## Testing

```bash
cd backend/auth-service && npm install && npm test    # repeat for each service
cd frontend && npm install && npm test
```

133 backend and 127 frontend unit tests. Guest, staff and admin permissions, MFA login, payment confirmation and the dashboard were also checked end to end against a running stack.

## License

Academic project. No license has been chosen yet.
