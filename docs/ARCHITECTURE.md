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
