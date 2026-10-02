-- =========================================================================
-- LIBERTA หัวหิน — Read-only DB user for admin-service
-- Run after schema.sql. Grants SELECT-only access to the tables admin-service's
-- dashboard needs — no INSERT/UPDATE/DELETE, enforced at the DB level in
-- addition to admin-service never calling save/insert/update/delete in code.
--
-- ${ADMIN_DB_PASSWORD} is a placeholder, substituted before execution by
-- database/03-grants.sh (fresh MySQL volume) or scripts/apply-grants.sh
-- (existing volume). Never run this file directly.
-- =========================================================================

CREATE USER IF NOT EXISTS 'admin_ro'@'%' IDENTIFIED BY '${ADMIN_DB_PASSWORD}';
-- CREATE ... IF NOT EXISTS leaves an existing user's password unchanged, so
-- set it explicitly too: re-running after ADMIN_DB_PASSWORD changes must work.
ALTER USER 'admin_ro'@'%' IDENTIFIED BY '${ADMIN_DB_PASSWORD}';
GRANT SELECT ON liberta_hotel.Booking    TO 'admin_ro'@'%';
GRANT SELECT ON liberta_hotel.Room       TO 'admin_ro'@'%';
GRANT SELECT ON liberta_hotel.RoomType   TO 'admin_ro'@'%';
GRANT SELECT ON liberta_hotel.Guest      TO 'admin_ro'@'%';
GRANT SELECT ON liberta_hotel.Employee   TO 'admin_ro'@'%';
FLUSH PRIVILEGES;
