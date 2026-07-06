/* eslint-disable no-console */
// Real-MySQL integration check for the 15-minute draft lock (business-critical path).
// Not part of `npm test` (mocked unit suite) — run manually with a live DB:
//   npx ts-node -r tsconfig-paths/register test-integration/concurrency-lock.ts
import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { LockService } from '../src/booking-lock/lock.service';
import { BookingService } from '../src/booking/booking.service';
import { BookingLog } from '../src/booking/entities/booking-log.entity';
import { Booking } from '../src/booking/entities/booking.entity';
import { Guest } from '../src/booking/entities/guest.entity';
import { Room } from '../src/booking/entities/room.entity';
import { RoomType } from '../src/booking/entities/room-type.entity';
import { SecurityLogger } from '../src/common/security-logger.service';

async function main() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'changeme',
    database: 'liberta_hotel',
    entities: [Booking, BookingLog, Guest, Room, RoomType],
    synchronize: false,
  });
  await dataSource.initialize();

  const config = new ConfigService({ BOOKING_DRAFT_LOCK_MINUTES: 15 });
  const lockService = { setLock: async () => undefined, clearLock: async () => undefined } as unknown as LockService;
  const securityLogger = new SecurityLogger();
  const bookingRepo = dataSource.getRepository(Booking);

  const service = new BookingService(dataSource, bookingRepo, lockService, config, securityLogger);

  // Room 2 has no existing bookings in seed data; use a fresh date range.
  const dto = {
    guestId: 1,
    roomId: 2,
    checkIn: '2026-09-01',
    checkOut: '2026-09-04',
    numGuests: 2,
  };

  console.log('--- Test 1: two concurrent draft requests for the same room/overlapping dates ---');
  const [r1, r2] = await Promise.allSettled([
    service.createDraft({ ...dto }),
    service.createDraft({ ...dto, checkIn: '2026-09-02', checkOut: '2026-09-05' }),
  ]);

  const outcomes = [r1, r2].map((r) =>
    r.status === 'fulfilled' ? 'SUCCESS' : (r as PromiseRejectedResult).reason?.constructor?.name,
  );
  console.log('Outcomes:', outcomes);
  const successCount = outcomes.filter((o) => o === 'SUCCESS').length;
  const conflictCount = outcomes.filter((o) => o === 'ConflictException').length;
  console.log(
    successCount === 1 && conflictCount === 1
      ? 'PASS: exactly one booking succeeded, one got 409 Conflict — real MySQL row lock serialized the race.'
      : `FAIL: expected 1 success + 1 conflict, got ${successCount} success + ${conflictCount} conflict`,
  );

  console.log('\n--- Test 2: adjacent (non-overlapping) dates on the same room do NOT conflict ---');
  const r3 = await service.createDraft({
    guestId: 1,
    roomId: 2,
    checkIn: '2026-09-04',
    checkOut: '2026-09-06',
    numGuests: 2,
  });
  console.log('PASS: adjacent-date booking succeeded, bookingId=', r3.bookingId);

  console.log('\n--- Test 3: stale Draft (Room 13, seed data) self-heals and allows a new booking ---');
  const staleRoomDto = { guestId: 2, roomId: 13, checkIn: '2026-07-15', checkOut: '2026-07-17', numGuests: 2 };
  const before = await bookingRepo.findOne({ where: { roomId: 13 }, order: { bookingId: 'DESC' } });
  console.log('Existing Draft status before:', before?.status, before?.lockExpiresAt);
  const r4 = await service.createDraft(staleRoomDto);
  console.log('PASS: self-heal allowed new booking, bookingId=', r4.bookingId);
  const healed = await bookingRepo.findOne({ where: { bookingId: before!.bookingId } });
  console.log(
    healed?.status === 'Expired'
      ? 'PASS: old stale Draft flipped to Expired in the same transaction.'
      : `FAIL: old stale Draft status is ${healed?.status}, expected Expired`,
  );

  await dataSource.destroy();
}

main().catch((e) => {
  console.error('SCRIPT ERROR:', e);
  process.exit(1);
});
