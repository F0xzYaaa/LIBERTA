# Hotel Management System — Complete Design Document

**Project type:** Basic Database Mini Project (Bachelor CS, Year 2)  
**Deliverable:** Microservices-based Hotel Management System with production deployment  
**Focus:** Database design + modern DevOps practices

---

## 1. Executive Summary

A microservices-based Hotel Management System for small-to-medium Thai hotels. Guests can browse and book rooms, staff can manage bookings and verify payments, admins can oversee the whole operation. Payments are handled via **PromptPay QR** with a slip-upload verification workflow. Staff and admin accounts are protected by **TOTP MFA** compatible with any authenticator app.

**Deployment:** Containerized with Docker, published to Docker Hub, pulled and run on a DigitalOcean VPS behind Nginx with self-signed TLS.

---

## 2. Tech Stack (Finalized)

| Layer | Technology |
|---|---|
| **Backend** | Node.js + NestJS (TypeScript) |
| **ORM** | TypeORM |
| **Primary Database** | MySQL 8 |
| **Cache / Sessions** | Redis 7 |
| **Frontend** | React 18 + Vite (TypeScript) |
| **Authentication** | JWT + bcrypt |
| **MFA** | TOTP via `otplib` (RFC 6238) |
| **Payment** | PromptPay QR via `promptpay-qr` npm library |
| **Reverse Proxy** | Nginx |
| **TLS** | OpenSSL self-signed certificate |
| **Containers** | Docker + Docker Compose |
| **Registry** | Docker Hub |
| **Hosting** | DigitalOcean VPS (Ubuntu 22.04) |
| **Image Storage** | VPS filesystem (Docker volume mount) |

---

## 3. Microservices Architecture

Six independent services communicating via REST over HTTP on an internal Docker network. Nginx sits at the edge, terminates TLS, and routes traffic.

```
Layer 1 — CLIENT
  Browser (guests + staff + admin)
       ↓ HTTPS
Layer 2 — EDGE
  Nginx (reverse proxy + TLS + static file serving)
       ↓ HTTP (internal)
Layer 3 — SERVICES (Docker containers)
  auth-service        (port 3001)  — login, JWT issuance
  mfa-service         (port 3002)  — TOTP secret + verification
  room-service        (port 3003)  — rooms, room types, images
  booking-service     (port 3004)  — reservations lifecycle
  payment-service     (port 3005)  — PromptPay QR + slip verification
  guest-service       (port 3006)  — guest CRUD
       ↓ SQL / Cache
Layer 4 — DATA
  MySQL 8 (persistent data)
  Redis 7 (cache, sessions, temp tokens)
```

**Communication:** All services communicate via REST APIs. Redis holds short-lived temp tokens (e.g. between password auth and MFA verification, 5-min TTL) and caches room availability queries.

---

## 4. Authentication Flow

Two-step authentication for staff and admin (guests use single-step).

```
Step 1: POST /auth/login {username, password}
        → auth-service verifies password (bcrypt)
        → returns temp_token (Redis, 5 min TTL)

Step 2: POST /mfa/verify {temp_token, totp_code}
        → mfa-service validates 6-digit TOTP
        → returns JWT access_token (24h) + refresh_token (7d)

Step 3: All future API calls carry Authorization: Bearer <JWT>
```

**MFA scope:** Required for staff and admin. Guests can enable it optionally.  
**Recovery:** Backup codes (10 one-time codes generated at MFA enrollment) + admin reset.

---

## 5. Payment System — PromptPay QR + Slip Upload

### 5.1 Why PromptPay
- No merchant account or business registration required
- Zero transaction fees (bank-to-bank transfers)
- Widely used across Thai hotels and shops
- Free EMVCo QR generation via `promptpay-qr` npm package

### 5.2 Flow
```
1. Guest checks out → total calculated
2. System generates PromptPay QR (valid 15 minutes)
3. Guest scans QR with any Thai banking app, pays
4. Guest uploads bank slip image
5. Staff reviews slip in admin panel
6. Staff clicks "Verify & Confirm" → Payment marked Paid
7. Booking status → CheckedOut
```

### 5.3 Payment Status State Machine (with Fraud Protection — Option A)

Statuses: `Pending`, `AwaitingVerify`, `Paid`, `Rejected`, `Blocked`, `Expired`

```
Pending ──(upload slip)──→ AwaitingVerify ──(staff approves)──→ Paid ✓
   │                             │
   │ (15 min timeout)            │ (staff rejects)
   ↓                             ↓
Expired                      Rejected
                                 │
                                 │ if retry_count < 3 → back to Pending
                                 │ if retry_count ≥ 3 → Blocked
                                 ↓
                              Blocked (admin reset required)
```

**Fraud protection rules:**
- Max 3 slip upload attempts per payment
- After 3 rejections, payment is `Blocked` — only admin can reset
- Every rejection logged with staff ID, reason, timestamp in `PaymentLog`
- Blocked payments show up on admin dashboard as alerts

### 5.4 Why Retry Is Allowed (Not a Bug)
Rejection reasons that are honest mistakes, not fraud:
- Wrong amount (typo — e.g. ฿2,000 instead of ฿2,500)
- Blurry / dark slip photo
- Wrong recipient PromptPay number
- Cut-off screenshot
- Uploaded wrong slip (old trip)
- Duplicate upload of same slip

Blocking on the first rejection would frustrate honest customers. The 3-strike limit balances customer service with fraud prevention.

---

## 6. Database Schema (11 Tables in 4 Domains)

All tables are in **3NF** (Third Normal Form), use `InnoDB` for foreign key support, and `utf8mb4` for full Unicode.

### Domain 1: Users & Authentication
- **Role** — role definitions (Guest, Staff, Admin)
- **Employee** — staff and admin accounts
- **MFASecret** — TOTP secret per employee (1:1)
- **BackupCode** — one-time recovery codes

### Domain 2: Hotel Assets
- **RoomType** — Standard / Deluxe / Suite with pricing
- **Room** — individual rooms with status
- **RoomImage** — multiple images per room (1:N)

### Domain 3: Guests & Bookings
- **Guest** — customer records
- **Booking** — reservations linking guest ↔ room ↔ dates

### Domain 4: Payments
- **Payment** — one row per transaction, includes `retry_count`, `max_retries`, `blocked_at` for fraud protection
- **PaymentSlip** — uploaded bank slips (1:N, retries allowed)
- **PaymentLog** — audit trail of every status change

### Key Relationships
- Role → Employee (1..N)
- Employee → MFASecret (1..1)
- RoomType → Room (1..N)
- Room → RoomImage (1..N)
- Guest → Booking (1..N)
- Room → Booking (1..N)
- Booking → Payment (1..1)
- Payment → PaymentSlip (1..N)
- Payment → PaymentLog (1..N)

### Normalization Trade-offs
- `Booking.total_price` is stored (denormalized) so historical bookings preserve the price the guest agreed to, even if `RoomType.price_per_night` changes later
- `PaymentSlip.image_path` stores a path, not the image blob — actual files live on the VPS filesystem

---

## 7. Frontend Screens

### Guest-facing
- Landing page — hero + featured rooms
- Room list — grid with image, price, availability filter
- Room detail — image carousel, amenities, book button
- Booking form — date picker, guest info, total calculation
- Payment page — PromptPay QR display + slip upload
- Booking confirmation — receipt + reference number

### Staff-facing (behind MFA)
- Login (username + password → TOTP code)
- Dashboard — today's check-ins, check-outs, pending payments
- Booking list — filter by status, search by guest
- Check-in / check-out workflow
- Payment verification queue — see uploaded slips, approve/reject

### Admin-facing (behind MFA)
- Everything staff has, plus:
- Room management (add/edit/delete rooms + upload images)
- RoomType management (pricing)
- Employee management (create accounts, reset MFA)
- Blocked payments queue (unblock with reason)
- Reports — occupancy, revenue, payment success rate

---

## 8. Deployment Pipeline

```
[LAPTOP - DEVELOPMENT]
  Code in NestJS + React
  Test locally with docker compose up
       ↓
[BUILD & PUSH]
  docker build for each service
  docker tag → docker push to Docker Hub
       ↓
[VPS - DIGITALOCEAN]
  VPS has only:
    - docker-compose.prod.yml
    - .env file with secrets
    - nginx/certs/ folder
  Run: docker compose pull && docker compose up -d
       ↓
[USERS]
  Access https://<vps-ip>
  Nginx handles TLS + routes to services
```

### Docker Compose Services (Production)
```yaml
services:
  nginx:            # 443 (TLS), 80 (redirect)
  frontend:         # React static build served by Nginx
  auth-service:     # 3001
  mfa-service:      # 3002
  room-service:     # 3003
  booking-service:  # 3004
  payment-service:  # 3005
  guest-service:    # 3006
  mysql:            # 3306 (internal only)
  redis:            # 6379 (internal only)

volumes:
  mysql_data:
  redis_data:
  room_images:      # room photo storage
  slip_images:      # payment slip storage
  nginx_certs:      # OpenSSL self-signed certs
```

---

## 9. Self-Signed TLS Certificate

Generated with OpenSSL on the VPS:
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/server.key \
  -out nginx/certs/server.crt \
  -subj "/C=TH/ST=Bangkok/L=Bangkok/O=HotelMS/CN=<vps-ip>"
```

Browsers will show a warning on first visit — acceptable for academic demo. In production, would replace with Let's Encrypt (real domain required).

---

## 10. Design System (Visual Identity)

### Color Palette
- **Primary (Navy):** `#1E2761` — headers, primary actions
- **Dark:** `#0F1729` — backgrounds, high-contrast text
- **Accent (Gold):** `#C9A961` — CTAs, highlights, brand accents
- **Cream:** `#F8F5F0` — soft card backgrounds
- **Teal:** `#0891B2` — secondary actions, MFA-related UI
- **Coral / Red:** `#B85042` — errors, rejection states
- **Gray:** `#64748B` — muted text, borders
- **Light Gray:** `#E2E8F0` — subtle dividers

### Typography
- **Headings:** Cambria (serif) — feels premium/hotel-like
- **Body:** Calibri (sans-serif) — clean, readable
- **Monospace:** For code snippets, reference numbers

### Domain Color Coding (used in ER diagram and admin panels)
- Users & Auth → Navy
- Hotel Assets (Rooms) → Teal
- Guests & Bookings → Gold
- Payments → Coral / Red

### UI Personality
Warm premium hotel aesthetic meets clean modern tech. Rounded corners (8px cards, 12px buttons). Generous whitespace. Subtle shadows on cards. No gradients.

---

## 11. Report Structure (5 Chapters)

Following Thai academic project format:

| Chapter | Content |
|---|---|
| **1. Introduction** | Background, objectives, scope, methodology, framework, timeline, tools, benefits |
| **2. Related Theories** | Relational DB concepts, microservices/REST, Docker, TOTP/MFA (RFC 6238), Nginx/TLS, PromptPay |
| **3. Methodology** | Actors & use cases, ER diagram (11 tables), normalization (1NF→3NF), payment state machine, interface design |
| **4. Results** | System architecture layers, deployment output, working demo |
| **5. Conclusion** | Summary, discussion (strengths/challenges), future work |

---

## 12. Deliverables Checklist

- [ ] SQL script — `hotel_schema.sql` (11 tables) ✅ *done*
- [ ] ER diagram — visual reference for the report ✅ *done*
- [ ] Seed data — sample INSERT statements
- [ ] Practice queries — JOINs, aggregates, subqueries
- [ ] NestJS microservices code (6 services)
- [ ] React frontend
- [ ] Dockerfile per service
- [ ] docker-compose.yml (dev) + docker-compose.prod.yml
- [ ] Nginx config with TLS
- [ ] Deployment guide (VPS setup)
- [ ] Written report (Thai academic format, ~50-100 pages)
- [ ] Presentation deck ✅ *done*

---

## 13. Future Work

- Real payment gateway integration (Omise / 2C2P for card payments)
- Let's Encrypt certificate with a real domain
- CI/CD pipeline (GitHub Actions auto-build on merge)
- Reporting & BI (occupancy heatmap, revenue trends)
- Mobile app (React Native)
- Housekeeping module (room cleaning status tracking)
- Multi-language support (Thai / English / Chinese)
- OCR for automatic slip verification
