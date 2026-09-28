import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingLog } from '../booking/entities/booking-log.entity';
import { Booking, BookingStatus } from '../booking/entities/booking.entity';
import { ExpiryCronService } from './expiry.cron';
import { LockService } from './lock.service';

describe('ExpiryCronService', () => {
  let service: ExpiryCronService;
  let bookingRepo: { find: jest.Mock; save: jest.Mock };
  let bookingLogRepo: { save: jest.Mock };
  let lockService: { clearLock: jest.Mock };

  beforeEach(async () => {
    bookingRepo = { find: jest.fn(), save: jest.fn() };
    bookingLogRepo = { save: jest.fn() };
    lockService = { clearLock: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpiryCronService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(BookingLog), useValue: bookingLogRepo },
        { provide: LockService, useValue: lockService },
      ],
    }).compile();

    service = moduleRef.get(ExpiryCronService);
  });

  it('does nothing when there are no stale drafts', async () => {
    bookingRepo.find.mockResolvedValue([]);

    await service.expireStaleDrafts();

    expect(bookingRepo.save).not.toHaveBeenCalled();
    expect(bookingLogRepo.save).not.toHaveBeenCalled();
  });

  it('expires each stale draft, writes a BookingLog entry, and clears its Redis lock', async () => {
    const staleDraft: Booking = {
      bookingId: 7,
      roomId: 3,
      status: BookingStatus.Draft,
      lockExpiresAt: new Date(Date.now() - 60_000),
    } as Booking;
    bookingRepo.find.mockResolvedValue([staleDraft]);
    bookingRepo.save.mockResolvedValue(staleDraft);
    bookingLogRepo.save.mockResolvedValue({});

    await service.expireStaleDrafts();

    expect(bookingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 7, status: BookingStatus.Expired, lockExpiresAt: null }),
    );
    expect(bookingLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 7,
        oldStatus: BookingStatus.Draft,
        newStatus: BookingStatus.Expired,
        changedBy: null,
      }),
    );
    expect(lockService.clearLock).toHaveBeenCalledWith(3);
  });

  it('does not let a Redis cleanup failure prevent the DB expiry from succeeding', async () => {
    const staleDraft: Booking = {
      bookingId: 7,
      roomId: 3,
      status: BookingStatus.Draft,
      lockExpiresAt: new Date(Date.now() - 60_000),
    } as Booking;
    bookingRepo.find.mockResolvedValue([staleDraft]);
    bookingRepo.save.mockResolvedValue(staleDraft);
    bookingLogRepo.save.mockResolvedValue({});
    lockService.clearLock.mockRejectedValue(new Error('redis down'));

    await expect(service.expireStaleDrafts()).resolves.toBeUndefined();
    expect(bookingRepo.save).toHaveBeenCalled();
  });
});
