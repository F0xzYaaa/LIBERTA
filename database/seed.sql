-- =========================================================================
-- LIBERTA หัวหิน — Sample Seed Data
-- Dev/demo only. All employee passwords = "password123" (bcrypt, cost 10).
-- DO NOT use these hashes/credentials in production.
-- =========================================================================

USE liberta_hotel;

-- ---------- Roles ----------
INSERT INTO Role (role_name, description) VALUES
    ('Staff', 'Front-desk staff: manage bookings, verify payments'),
    ('Admin', 'Full access: rooms, employees, MFA reset, dashboard');

-- ---------- Employees ----------
-- password_hash below = bcrypt('password123', 10)
INSERT INTO Employee (role_id, username, password_hash, full_name, email, phone, mfa_enabled, is_active) VALUES
    (2, 'admin',    '$2b$10$z6Fvf1NYmXYkUKdA3OopqejkkArwQs8GsrsqdGlPFqJf8qTpP4iIq', 'Nattapong Suriya',   'admin@libertahuahin.com',   '081-234-5678', FALSE, TRUE),
    (1, 'staff01',  '$2b$10$z6Fvf1NYmXYkUKdA3OopqejkkArwQs8GsrsqdGlPFqJf8qTpP4iIq', 'Ploy Wattana',       'ploy@libertahuahin.com',    '081-345-6789', FALSE, TRUE),
    (1, 'staff02',  '$2b$10$z6Fvf1NYmXYkUKdA3OopqejkkArwQs8GsrsqdGlPFqJf8qTpP4iIq', 'Somchai Rakthai',    'somchai@libertahuahin.com', '081-456-7890', FALSE, TRUE);

-- ---------- Room Types (5) ----------
INSERT INTO RoomType (type_name, price_per_night, capacity, description, package_details) VALUES
    ('Sea View Suite', 4500.00, 2,
     'Spacious suite with panoramic Gulf of Thailand views, private balcony, and king bed.',
     JSON_OBJECT('amenities', JSON_ARRAY('Sea view balcony', 'King bed', 'Rain shower', 'Minibar', 'Free WiFi'), 'breakfast_included', true)),
    ('Forest View Deluxe', 3200.00, 2,
     'Deluxe room overlooking the hotel garden and hillside forest, queen bed, quiet retreat.',
     JSON_OBJECT('amenities', JSON_ARRAY('Garden view', 'Queen bed', 'Work desk', 'Free WiFi'), 'breakfast_included', true)),
    ('Mountain Retreat', 3800.00, 3,
     'Elevated room with hill views, extra daybed, ideal for small families.',
     JSON_OBJECT('amenities', JSON_ARRAY('Hill view', 'Queen bed + daybed', 'Free WiFi', 'Bathtub'), 'breakfast_included', true)),
    ('Heritage Twin', 2800.00, 2,
     'Classic twin-bed room with heritage Hua Hin decor, close to the lobby.',
     JSON_OBJECT('amenities', JSON_ARRAY('Twin beds', 'Free WiFi', 'Work desk'), 'breakfast_included', false)),
    ('Family Garden Villa', 5500.00, 4,
     'Standalone villa with private garden entrance, two bedrooms, ideal for families.',
     JSON_OBJECT('amenities', JSON_ARRAY('Private garden', 'Two bedrooms', 'Kitchenette', 'Free WiFi', 'Bathtub'), 'breakfast_included', true));

-- ---------- Rooms (20) ----------
-- Sea View Suite (room_type_id=1): floor 3-4
INSERT INTO Room (room_type_id, room_number, floor, status) VALUES
    (1, '301', 3, 'Available'),
    (1, '302', 3, 'Available'),
    (1, '401', 4, 'Available'),
    (1, '402', 4, 'Occupied');

-- Forest View Deluxe (room_type_id=2): floor 2
INSERT INTO Room (room_type_id, room_number, floor, status) VALUES
    (2, '201', 2, 'Available'),
    (2, '202', 2, 'Available'),
    (2, '203', 2, 'Available'),
    (2, '204', 2, 'Maintenance'),
    (2, '205', 2, 'Available');

-- Mountain Retreat (room_type_id=3): floor 3
INSERT INTO Room (room_type_id, room_number, floor, status) VALUES
    (3, '303', 3, 'Available'),
    (3, '304', 3, 'Available'),
    (3, '305', 3, 'Occupied');

-- Heritage Twin (room_type_id=4): floor 1
INSERT INTO Room (room_type_id, room_number, floor, status) VALUES
    (4, '101', 1, 'Available'),
    (4, '102', 1, 'Available'),
    (4, '103', 1, 'Available'),
    (4, '104', 1, 'OutOfService'),
    (4, '105', 1, 'Available');

-- Family Garden Villa (room_type_id=5): floor 1 (ground, garden access)
INSERT INTO Room (room_type_id, room_number, floor, status) VALUES
    (5, 'V01', 1, 'Available'),
    (5, 'V02', 1, 'Available'),
    (5, 'V03', 1, 'Available');

-- ---------- Guests ----------
INSERT INTO Guest (first_name, last_name, phone, email, nationality, loyalty_points) VALUES
    ('Warinthorn', 'Chaiyasit', '089-111-2222', 'warinthorn.c@example.com', 'Thai', 120),
    ('Emily',      'Carter',    '089-222-3333', 'emily.carter@example.com', 'British', 0),
    ('Kittisak',   'Boonmee',   '089-333-4444', 'kittisak.b@example.com',   'Thai', 50),
    ('Hana',       'Sato',      '089-444-5555', 'hana.sato@example.com',    'Japanese', 0),
    ('Somsri',     'Intharak',  '089-555-6666', 'somsri.i@example.com',     'Thai', 300);

-- ---------- Sample Bookings (5) ----------
-- 1: Confirmed/Reserved, payment verified by staff01
INSERT INTO Booking (guest_id, room_id, check_in, check_out, num_guests, total_price, status,
                      payment_note, payment_confirmed_by, payment_confirmed_at, created_at) VALUES
    (1, 1, '2026-07-10', '2026-07-13', 2, 13500.00, 'Reserved',
     'PromptPay transfer 2026-07-06 14:32, ref BK-2026-0001', 2, '2026-07-06 14:35:00', '2026-07-06 10:00:00');

-- 2: Currently checked in
INSERT INTO Booking (guest_id, room_id, check_in, check_out, num_guests, total_price, status,
                      payment_note, payment_confirmed_by, payment_confirmed_at, created_at) VALUES
    (2, 5, '2026-07-04', '2026-07-08', 2, 12800.00, 'CheckedIn',
     'Bank transfer 2026-07-01 09:10, ref BK-2026-0002', 3, '2026-07-01 09:15:00', '2026-06-30 18:00:00');

-- 3: Completed stay
INSERT INTO Booking (guest_id, room_id, check_in, check_out, num_guests, total_price, status,
                      payment_note, payment_confirmed_by, payment_confirmed_at, created_at) VALUES
    (3, 10, '2026-06-20', '2026-06-22', 3, 7600.00, 'CheckedOut',
     'PromptPay transfer 2026-06-18 11:00, ref BK-2026-0003', 2, '2026-06-18 11:05:00', '2026-06-17 20:00:00');

-- 4: Active Draft (15-min lock, not yet contacted staff) — simulate a lock 10 min in the future
INSERT INTO Booking (guest_id, room_id, check_in, check_out, num_guests, total_price, status,
                      lock_expires_at, created_at) VALUES
    (4, 13, '2026-07-15', '2026-07-17', 2, 5600.00, 'Draft',
     DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW());

-- 5: Cancelled booking
INSERT INTO Booking (guest_id, room_id, check_in, check_out, num_guests, total_price, status,
                      special_request, created_at, updated_at) VALUES
    (5, 17, '2026-07-01', '2026-07-03', 4, 11000.00, 'Cancelled',
     'Guest requested cancellation due to travel change.', '2026-06-25 09:00:00', '2026-06-26 10:00:00');

-- ---------- Booking Log (audit trail matching bookings above) ----------
INSERT INTO BookingLog (booking_id, old_status, new_status, changed_by, note, changed_at) VALUES
    (1, 'Draft', 'Reserved', 2, 'Payment slip verified via Line', '2026-07-06 14:35:00'),
    (2, 'Draft', 'Reserved', 3, 'Payment slip verified via Facebook', '2026-07-01 09:15:00'),
    (2, 'Reserved', 'CheckedIn', 3, 'Guest checked in at front desk', '2026-07-04 14:00:00'),
    (3, 'Draft', 'Reserved', 2, 'Payment slip verified via Line', '2026-06-18 11:05:00'),
    (3, 'Reserved', 'CheckedIn', 2, 'Guest checked in', '2026-06-20 14:00:00'),
    (3, 'CheckedIn', 'CheckedOut', 2, 'Guest checked out, room inspected', '2026-06-22 11:00:00'),
    (5, 'Draft', 'Reserved', 3, 'Payment slip verified via Line', '2026-06-25 12:00:00'),
    (5, 'Reserved', 'Cancelled', 3, 'Guest requested cancellation due to travel change', '2026-06-26 10:00:00');
