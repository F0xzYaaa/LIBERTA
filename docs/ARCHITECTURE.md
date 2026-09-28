# Architecture — LIBERTA หัวหิน

> Placeholder created in Stage 1. Full content will be filled in as each service is built (Stages 2-4).

## Overview

Six independent NestJS microservices behind Nginx, communicating over REST on an internal Docker network. See the root [`README.md`](../README.md) for the current architecture diagram and tech stack table.

## Services

| Service | Port | Responsibility | Status |
|---|---|---|---|
| auth-service | 3001 | Login, JWT issuance, password management | Stage 2 |
| mfa-service | 3002 | TOTP secret generation, QR code, verification | Stage 2 |
| guest-service | 3003 | Guest registration and profile | Stage 3 |
| room-service | 3004 | Rooms, room types, room images | Stage 3 |
| booking-service | 3005 | Reservations, 15-minute draft lock | Stage 3 |
| admin-service | 3006 | Staff/admin operations, dashboard aggregations | Stage 4 |

## Sections to fill in as stages complete

- Service-by-service module structure (owned by architect agent per service)
- Data flow diagrams for the booking draft-lock flow (Redis + MySQL `SELECT ... FOR UPDATE`)
- Auth flow sequence diagram (password -> temp_token -> TOTP -> JWT)
- Inter-service communication patterns (which services call which, over what)

## Stage 6 production hardening — accepted final state (2026-07-11)

**Logging:** `SecurityLogger`'s structured JSON stdout-only logging (no rotation or
persistence layer) is the accepted final state for this project's scale, not a
placeholder awaiting a later hardening pass. CES made this call on 2026-07-11:
Docker's own log driver already captures stdout, and real log persistence/rotation
is production-scale infra this academic mini-project doesn't need.

**Frontend bundle size:** the frontend's single-chunk ~757KB JS bundle-size build
warning is a known, deferred item — not fixed in Stage 6 per CES's explicit
2026-07-11 decision, since it's pure performance polish with no correctness/security
impact. If a future session wants to pick this up, code-splitting (route-based lazy
loading via `React.lazy`, or Vite `manualChunks`) is the known fix.
