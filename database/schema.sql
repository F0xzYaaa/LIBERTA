-- =========================================================================
-- LIBERTA หัวหิน — Hotel Management System
-- Complete Database Schema
-- Basic Database Mini Project (Bachelor CS)
-- Target: MySQL 8.0+
-- =========================================================================
-- Design principles:
--   1. All tables in 3NF (Third Normal Form)
--   2. Referential integrity via FOREIGN KEYs
--   3. ENUMs used for finite state values
--   4. Timestamps auto-managed
--   5. UNIQUE constraints where business rules require
--   6. No payment gateway / no PromptPay QR — payment fields live on Booking,
--      confirmed manually by staff after external slip verification
-- =========================================================================

DROP DATABASE IF EXISTS liberta_hotel;
CREATE DATABASE liberta_hotel
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE liberta_hotel;

-- =========================================================================
-- DOMAIN 1: USERS & AUTHENTICATION
-- =========================================================================

-- ---------- Role ----------
CREATE TABLE Role (
    role_id         INT PRIMARY KEY AUTO_INCREMENT,
    role_name       VARCHAR(30) NOT NULL UNIQUE,   -- e.g. Staff, Admin
    description     VARCHAR(200),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Employee (staff + admin) ----------
CREATE TABLE Employee (
    employee_id     INT PRIMARY KEY AUTO_INCREMENT,
    role_id         INT NOT NULL,
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,       -- bcrypt hash
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(100) NOT NULL UNIQUE,
    phone           VARCHAR(20),
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES Role(role_id)
) ENGINE=InnoDB;

CREATE INDEX idx_employee_username ON Employee(username);
CREATE INDEX idx_employee_email    ON Employee(email);

-- ---------- MFASecret (TOTP secret per employee) ----------
CREATE TABLE MFASecret (
    mfa_id          INT PRIMARY KEY AUTO_INCREMENT,
    employee_id     INT NOT NULL UNIQUE,          -- one secret per employee
    secret          VARCHAR(255) NOT NULL,        -- base32-encoded TOTP secret
    activated_at    DATETIME,                     -- when user first verified
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES Employee(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- BackupCode (one-time recovery codes) ----------
CREATE TABLE BackupCode (
    code_id         INT PRIMARY KEY AUTO_INCREMENT,
    employee_id     INT NOT NULL,
    code_hash       VARCHAR(255) NOT NULL,        -- hashed backup code
    used            BOOLEAN NOT NULL DEFAULT FALSE,
    used_at         DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES Employee(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_backup_employee ON BackupCode(employee_id);

-- =========================================================================
-- DOMAIN 2: HOTEL ASSETS (Rooms)
-- =========================================================================

-- ---------- RoomType ----------
CREATE TABLE RoomType (
    room_type_id    INT PRIMARY KEY AUTO_INCREMENT,
    type_name       VARCHAR(50) NOT NULL UNIQUE,  -- e.g. Sea View Suite, Forest View Deluxe
    price_per_night DECIMAL(10,2) NOT NULL,
    capacity        INT NOT NULL,                 -- max guests
    description     TEXT,
    package_details JSON,                         -- amenities, inclusions, etc.
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (price_per_night >= 0),
    CHECK (capacity > 0)
) ENGINE=InnoDB;

-- ---------- Room ----------
CREATE TABLE Room (
    room_id         INT PRIMARY KEY AUTO_INCREMENT,
    room_type_id    INT NOT NULL,
    room_number     VARCHAR(10) NOT NULL UNIQUE,
    floor           INT NOT NULL,
    status          ENUM('Available','Occupied','Maintenance','OutOfService')
                    NOT NULL DEFAULT 'Available',
    notes           VARCHAR(255),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_type_id) REFERENCES RoomType(room_type_id)
) ENGINE=InnoDB;

CREATE INDEX idx_room_status ON Room(status);
CREATE INDEX idx_room_type   ON Room(room_type_id);

-- ---------- RoomImage (multiple images per room) ----------
CREATE TABLE RoomImage (
    image_id        INT PRIMARY KEY AUTO_INCREMENT,
    room_id         INT NOT NULL,
    image_path      VARCHAR(500) NOT NULL,        -- /uploads/rooms/2026/07/xyz.jpg
    caption         VARCHAR(200),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    display_order   INT NOT NULL DEFAULT 0,
    file_size       INT,
    mime_type       VARCHAR(50),
    uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES Room(room_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_image_room ON RoomImage(room_id);

-- =========================================================================
-- DOMAIN 3: GUESTS & BOOKINGS
-- =========================================================================

-- ---------- Guest (light account: contact info only, no password) ----------
CREATE TABLE Guest (
    guest_id        INT PRIMARY KEY AUTO_INCREMENT,
    first_name      VARCHAR(50) NOT NULL,
    last_name       VARCHAR(50) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    email           VARCHAR(100),
    id_card         VARCHAR(20) UNIQUE,           -- Thai ID or passport, nullable
    nationality     VARCHAR(50) DEFAULT 'Thai',
    address         TEXT,
    loyalty_points  INT NOT NULL DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_guest_phone ON Guest(phone);
CREATE INDEX idx_guest_email ON Guest(email);

-- ---------- Booking ----------
-- Payment is fully manual/staff-mediated: no gateway, no QR. Payment fields
-- live directly on Booking rather than a separate Payment domain.
CREATE TABLE Booking (
    booking_id            INT PRIMARY KEY AUTO_INCREMENT,
    guest_id              INT NOT NULL,
    room_id               INT NOT NULL,
    check_in              DATE NOT NULL,
    check_out             DATE NOT NULL,
    num_guests            INT NOT NULL DEFAULT 1,
    total_price           DECIMAL(10,2) NOT NULL,
    status                ENUM('Draft','Reserved','CheckedIn','CheckedOut','Cancelled','NoShow','Expired')
                          NOT NULL DEFAULT 'Draft',
    lock_expires_at       DATETIME,               -- 15-min draft lock; NULL once confirmed/expired
    payment_note          VARCHAR(255),           -- e.g. "PromptPay 08/07 14:32"
    slip_image_path       VARCHAR(500),
    payment_confirmed_by  INT,                    -- Employee who confirmed payment
    payment_confirmed_at  DATETIME,
    special_request       TEXT,
    created_by            INT,                    -- Employee who created booking, NULL if guest-initiated online
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (guest_id)             REFERENCES Guest(guest_id),
    FOREIGN KEY (room_id)              REFERENCES Room(room_id),
    FOREIGN KEY (payment_confirmed_by) REFERENCES Employee(employee_id),
    FOREIGN KEY (created_by)           REFERENCES Employee(employee_id),
    CHECK (check_out > check_in),
    CHECK (total_price >= 0),
    CHECK (num_guests > 0)
) ENGINE=InnoDB;

CREATE INDEX idx_booking_guest  ON Booking(guest_id);
CREATE INDEX idx_booking_room   ON Booking(room_id);
CREATE INDEX idx_booking_dates  ON Booking(check_in, check_out);
CREATE INDEX idx_booking_status ON Booking(status);
CREATE INDEX idx_booking_lock   ON Booking(lock_expires_at);
CREATE INDEX idx_booking_payment_confirmed_at ON Booking(payment_confirmed_at);

-- ---------- BookingLog (audit trail of status changes) ----------
CREATE TABLE BookingLog (
    log_id          INT PRIMARY KEY AUTO_INCREMENT,
    booking_id      INT NOT NULL,
    old_status      VARCHAR(20),
    new_status      VARCHAR(20) NOT NULL,
    changed_by      INT,                          -- NULL if system-triggered (e.g. draft expiry)
    note            VARCHAR(255),
    changed_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES Booking(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES Employee(employee_id)
) ENGINE=InnoDB;

CREATE INDEX idx_log_booking ON BookingLog(booking_id);

-- =========================================================================
-- SUMMARY
-- =========================================================================
-- Total tables : 10
-- Users domain : Role, Employee, MFASecret, BackupCode
-- Rooms domain : RoomType, Room, RoomImage
-- Guests domain: Guest, Booking, BookingLog
-- No Payments domain — payment fields live on Booking (manual, staff-mediated)
-- =========================================================================
