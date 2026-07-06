# API Reference — LIBERTA หัวหิน

> Placeholder created in Stage 1. Endpoint contracts will be documented here as each service is implemented (Stages 2-4). Each service also exposes live Swagger docs once built.

## Conventions

- All request bodies validated via `class-validator` DTOs
- All error responses use standard HTTP status codes with a JSON body: `{ statusCode, message, error }`
- All protected endpoints require `Authorization: Bearer <JWT>`
- Guest-facing endpoints are public except booking creation, which is rate-limited

## Services (to be documented per stage)

### auth-service (3001) — Stage 2
- `POST /auth/login`
- `POST /auth/register-employee`

### mfa-service (3002) — Stage 2
- `POST /mfa/generate`
- `POST /mfa/verify`

### guest-service (3003) — Stage 3
- `POST /guests/register`
- `GET /guests/:id`

### room-service (3004) — Stage 3
- `GET /rooms`
- `GET /rooms/:id`
- `POST /rooms/:id/images`

### booking-service (3005) — Stage 3
- `POST /bookings/draft`
- `GET /bookings/:id`
- `POST /bookings/:id/confirm-payment`

### admin-service (3006) — Stage 4
- `GET /admin/dashboard`
- `GET /admin/bookings`
