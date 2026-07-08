-- =========================================================================
-- LIBERTA หัวหิน — Read-only DB user for admin-service
-- Run after schema.sql. Grants SELECT-only access to the tables admin-service's
-- dashboard needs — no INSERT/UPDATE/DELETE, enforced at the DB level in
-- addition to admin-service never calling save/insert/update/delete in code.
-- =========================================================================

CREATE USER IF NOT EXISTS 'admin_ro'@'%' IDENTIFIED BY '${ADMIN_DB_PASSWORD}';
GRANT SELECT ON liberta_hotel.Booking    TO 'admin_ro'@'%';
GRANT SELECT ON liberta_hotel.Room       TO 'admin_ro'@'%';
GRANT SELECT ON liberta_hotel.RoomType   TO 'admin_ro'@'%';
GRANT SELECT ON liberta_hotel.Guest      TO 'admin_ro'@'%';
GRANT SELECT ON liberta_hotel.Employee   TO 'admin_ro'@'%';
FLUSH PRIVILEGES;
