import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { LockService } from '../booking-lock/lock.service';
import { SecurityLogger } from '../common/security-logger.service';
import { BookingService } from './booking.service';
import { BookingLog } from './entities/booking-log.entity';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Guest } from './entities/guest.entity';

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepo: {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let lockService: { setLock: jest.Mock; clearLock: jest.Mock };
  let config: { get: jest.Mock };
  let manager: {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  const dto = {
    guestId: 1,
    roomId: 1,
    checkIn: '2026-07-10',
    checkOut: '2026-07-13',
    numGuests: 2,
  };

  const guest: Guest = { guestId: 1, firstName: 'A', lastName: 'B', phone: '089-1', email: null };
  const room = {
    roomId: 1,
    roomTypeId: 1,
    roomNumber: '301',
    roomType: { capacity: 2, pricePerNight: 4500 },
  };

  function makeQueryBuilder(rows: Booking[]) {
    return {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
  }

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
      create: jest.fn((_entity, data) => data),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
    };
    bookingRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    lockService = { setLock: jest.fn().mockResolvedValue(undefined), clearLock: jest.fn() };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, number> = { BOOKING_DRAFT_LOCK_MINUTES: 15 };
        return values[key];
      }),
    };
    const securityLogger = { log: jest.fn(), warn: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: LockService, useValue: lockService },
        { provide: ConfigService, useValue: config },
        { provide: SecurityLogger, useValue: securityLogger },
      ],
    }).compile();

    service = moduleRef.get(BookingService);
  });

  describe('createDraft', () => {
    it('rejects when checkOut is not after checkIn', async () => {
      await expect(
        service.createDraft({ ...dto, checkIn: '2026-07-13', checkOut: '2026-07-10' }),
      ).rejects.toThrow(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects when the guest does not exist', async () => {
      manager.findOne.mockResolvedValueOnce(null);

      await expect(service.createDraft(dto)).rejects.toThrow(NotFoundException);
    });

    it('rejects when the room does not exist', async () => {
      manager.findOne.mockResolvedValueOnce(guest).mockResolvedValueOnce(null);

      await expect(service.createDraft(dto)).rejects.toThrow(NotFoundException);
    });

    it('rejects when numGuests exceeds RoomType.capacity', async () => {
      manager.findOne.mockResolvedValueOnce(guest).mockResolvedValueOnce(room);

      await expect(service.createDraft({ ...dto, numGuests: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a Draft booking and BookingLog when the room is free, and caches the lock in Redis', async () => {
      manager.findOne.mockResolvedValueOnce(guest).mockResolvedValueOnce(room);
      manager.createQueryBuilder.mockReturnValue(makeQueryBuilder([]));
      manager.save.mockImplementation((_entity, data) =>
        Promise.resolve({ bookingId: 42, createdAt: new Date('2026-07-06'), ...data }),
      );

      const result = await service.createDraft(dto);

      expect(result.reference).toBe('BK-2026-000042');
      expect(result.totalPrice).toBe(4500 * 3);
      expect(lockService.setLock).toHaveBeenCalledWith(1, 15 * 60);
      const bookingLogSaveCall = manager.save.mock.calls.find((c) => c[0] === BookingLog);
      expect(bookingLogSaveCall[1]).toMatchObject({ newStatus: BookingStatus.Draft });
    });

    it('rejects with 409 when an overlapping active booking exists for the same room', async () => {
      manager.findOne.mockResolvedValueOnce(guest).mockResolvedValueOnce(room);
      const blockingBooking: Partial<Booking> = {
        bookingId: 1,
        status: BookingStatus.Reserved,
        lockExpiresAt: null,
      };
      manager.createQueryBuilder.mockReturnValue(makeQueryBuilder([blockingBooking as Booking]));

      await expect(service.createDraft(dto)).rejects.toThrow(ConflictException);
      expect(lockService.setLock).not.toHaveBeenCalled();
    });

    it('self-heals a stale Draft (lockExpiresAt in the past) inline and proceeds to create the new booking', async () => {
      manager.findOne.mockResolvedValueOnce(guest).mockResolvedValueOnce(room);
      const staleDraft: Partial<Booking> = {
        bookingId: 7,
        status: BookingStatus.Draft,
        lockExpiresAt: new Date(Date.now() - 60_000),
      };
      manager.createQueryBuilder.mockReturnValue(makeQueryBuilder([staleDraft as Booking]));
      manager.save.mockImplementation((_entity, data) =>
        Promise.resolve({ bookingId: 42, createdAt: new Date('2026-07-06'), ...data }),
      );

      const result = await service.createDraft(dto);

      expect(result.reference).toBe('BK-2026-000042');
      // The stale draft itself must have been saved with status Expired before the new booking was created.
      const expiredSaveCall = manager.save.mock.calls.find(
        (c) => c[0] === Booking && c[1].bookingId === 7,
      );
      expect(expiredSaveCall[1].status).toBe(BookingStatus.Expired);
    });

    it('still rejects with 409 if other blocking rows remain after self-healing the stale ones', async () => {
      manager.findOne.mockResolvedValueOnce(guest).mockResolvedValueOnce(room);
      const staleDraft: Partial<Booking> = {
        bookingId: 7,
        status: BookingStatus.Draft,
        lockExpiresAt: new Date(Date.now() - 60_000),
      };
      const activeReserved: Partial<Booking> = {
        bookingId: 8,
        status: BookingStatus.Reserved,
        lockExpiresAt: null,
      };
      manager.createQueryBuilder.mockReturnValue(
        makeQueryBuilder([staleDraft as Booking, activeReserved as Booking]),
      );

      await expect(service.createDraft(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('lookup', () => {
    it('returns 404 for a malformed reference', async () => {
      await expect(
        service.lookup({ reference: 'NOT-A-REFERENCE', contact: '089-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 when the reference does not match any booking', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.lookup({ reference: 'BK-2026-000042', contact: '089-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 when the reference is valid but the contact does not match', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 42,
        createdAt: new Date('2026-07-06'),
        guest: { phone: '089-1', email: null },
        status: BookingStatus.Reserved,
        checkIn: '2026-07-10',
        checkOut: '2026-07-13',
        totalPrice: 13500,
        room: { roomNumber: '301', roomType: { typeName: 'Sea View Suite' } },
      });

      await expect(
        service.lookup({ reference: 'BK-2026-000042', contact: 'wrong-contact' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns limited booking details when reference and contact both match', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 42,
        createdAt: new Date('2026-07-06'),
        guest: { phone: '089-1', email: null },
        status: BookingStatus.Reserved,
        checkIn: '2026-07-10',
        checkOut: '2026-07-13',
        totalPrice: 13500,
        room: { roomNumber: '301', roomType: { typeName: 'Sea View Suite' } },
      });

      const result = await service.lookup({ reference: 'BK-2026-000042', contact: '089-1' });

      expect(result).toEqual({
        reference: 'BK-2026-000042',
        status: BookingStatus.Reserved,
        checkIn: '2026-07-10',
        checkOut: '2026-07-13',
        roomNumber: '301',
        roomType: 'Sea View Suite',
        totalPrice: 13500,
      });
      expect(result).not.toHaveProperty('guestId');
    });
  });
});
