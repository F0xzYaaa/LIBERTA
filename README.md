# LIBERTA หัวหิน — Hotel Management System

Microservices-based Hotel Management System for a boutique Hua Hin hotel. Built as a Bachelor CS database mini-project, structured like a real production system.

## Architecture

Six independent NestJS services behind Nginx, communicating over REST on an internal Docker network.

```
Browser (guest + staff/admin)
   | HTTPS
Nginx (reverse proxy, TLS, static frontend)
   | HTTP (internal Docker network)
auth(3001)  mfa(3002)  guest(3003)  room(3004)  booking(3005)  admin(3006)
   | SQL / Cache
MySQL 8 (persistent)   Redis 7 (draft-lock cache, temp tokens)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + NestJS (TypeScript, strict mode) |
| ORM | TypeORM |
| Database | MySQL 8 |
| Cache | Redis 7 |
| Frontend | React 18 + Vite (TypeScript) |
| Auth | JWT + bcrypt |
| MFA | TOTP via `otplib` (RFC 6238) |
| Reverse Proxy | Nginx |
| TLS | OpenSSL self-signed |
| Containers | Docker + Docker Compose |
| Registry | Docker Hub |

## Database

10 tables in 3NF across 3 domains — see [`database/schema.sql`](database/schema.sql):

- **Users & Auth:** `Role`, `Employee`, `MFASecret`, `BackupCode`
- **Hotel Assets:** `RoomType`, `Room`, `RoomImage`
- **Guests & Bookings:** `Guest`, `Booking`, `BookingLog`

Payment is fully manual and staff-mediated — no gateway, no QR generation. Payment fields (`payment_note`, `slip_image_path`, `payment_confirmed_by/at`) live directly on `Booking`.

Sample data (5 room types, 20 rooms, 3 employees, 5 guests, 5 bookings) is in [`database/seed.sql`](database/seed.sql).

## Key Business Logic

**Guest booking flow:** Guest browses rooms, registers with just name/email/phone (no password), clicks "Book" → creates a `Draft` booking with a 15-minute lock (MySQL `SELECT ... FOR UPDATE` transaction + Redis TTL cache for fast concurrency checks). Guest gets a reference number (`BK-YYYY-NNNN`) and is told to contact the hotel via Line/Facebook to confirm. A background job expires stale drafts every minute.

**Staff-mediated payment:** Guest pays externally via PromptPay (personal account, no API), sends a slip via social media. Staff uploads the slip into the system and confirms payment manually — `Draft` → `Reserved`. Every status change is written to `BookingLog`.

**Staff/admin auth:** username + password (bcrypt) → temp token → TOTP code (otplib) → JWT. MFA required for all staff/admin.

## Project Structure

```
services/
  auth-service/       (3001) — login, JWT issuance, password management
  mfa-service/         (3002) — TOTP secret generation, QR code, verification
  guest-service/       (3003) — guest registration and profile
  room-service/        (3004) — rooms, room types, room images
  booking-service/     (3005) — reservations, 15-min draft lock
  admin-service/       (3006) — staff/admin operations, dashboard aggregations
frontend/              — React + Vite (guest site + /admin)
nginx/                 — reverse proxy config + self-signed TLS certs (gitignored)
database/
  schema.sql           — full CREATE TABLE statements
  seed.sql             — sample data
  migrations/          — TypeORM migrations
docs/
  ARCHITECTURE.md
  API.md
  DEPLOYMENT.md
```

## Setup (Development)

1. Copy `.env.example` to `.env` and fill in real secrets.
2. `docker compose up` — starts MySQL, Redis, and all six services (schema + seed auto-load on first MySQL start).
3. `scripts/apply-grants.sh` — creates the read-only `admin_ro` MySQL user admin-service needs (not part of the schema/seed auto-load; run once after MySQL is up, and again if `ADMIN_DB_PASSWORD` changes in `.env`).
4. Frontend dev server: `cd frontend && npm install && npm run dev`.

Services are currently stubbed (Stage 1). Each service's NestJS implementation lands in later stages.

## Seed Credentials (dev only)

| Username | Password | Role |
|---|---|---|
| admin | password123 | Admin |
| staff01 | password123 | Staff |
| staff02 | password123 | Staff |

**Never use these in production.** MFA is not yet enabled for seeded accounts (`mfa_enabled = FALSE`); MFA enrollment happens through the mfa-service once built.

## Roadmap

- [x] Stage 1 — Folder structure, schema.sql, seed.sql, docker-compose.yml, README
- [ ] Stage 2 — auth-service + mfa-service (NestJS, unit tests)
- [ ] Stage 3 — guest-service, room-service, booking-service (15-min lock logic)
- [ ] Stage 4 — admin-service + Nginx + self-signed TLS
- [ ] Stage 5 — Frontend (React + Vite, LIBERTA branding)
- [ ] Stage 6 — Docker production compose + DigitalOcean deployment guide
