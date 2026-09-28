import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { LockService } from '../booking-lock/lock.service';
import { SecurityLogger } from '../common/security-logger.service';
import { BookingService } from './booking.service';
import { BookingLog } from './entities/booking-log.entity';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Guest } from './entities/guest.entity';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn().mockReturnValue('mock-stream'),
}));

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepo: {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let roomRepo: { find: jest.Mock };
  let roomTypeRepo: { findOne: jest.Mock };
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

  function makeSingleRowQueryBuilder(row: Booking | null) {
    return {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(row),
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
    roomRepo = { find: jest.fn() };
    roomTypeRepo = { findOne: jest.fn() };
    lockService = { setLock: jest.fn().mockResolvedValue(undefined), clearLock: jest.fn() };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, number | string> = {
          BOOKING_DRAFT_LOCK_MINUTES: 15,
          BOOKING_SLIP_UPLOAD_DIR: '/app/uploads/slips',
          BOOKING_SLIP_MAX_SIZE_BYTES: 5 * 1024 * 1024,
        };
        return values[key];
      }),
    };
    const securityLogger = { log: jest.fn(), warn: jest.fn() };
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Room), useValue: roomRepo },
        { provide: getRepositoryToken(RoomType), useValue: roomTypeRepo },
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

  describe('findAvailableRoom', () => {
    const availDto = { roomTypeId: 1, checkIn: '2026-07-10', checkOut: '2026-07-13' };
    const roomType = {
      roomTypeId: 1,
      typeName: 'Sea View Suite',
      pricePerNight: 4500,
      capacity: 2,
    };

    function makeOverlapQueryBuilder(rows: Booking[]) {
      return {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
    }

    it('rejects when checkOut is not after checkIn', async () => {
      await expect(
        service.findAvailableRoom({ ...availDto, checkIn: '2026-07-13', checkOut: '2026-07-10' }),
      ).rejects.toThrow(BadRequestException);
      expect(roomTypeRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects with 404 (no room of this type) when the room type does not exist', async () => {
      roomTypeRepo.findOne.mockResolvedValue(null);

      await expect(service.findAvailableRoom(availDto)).rejects.toThrow(NotFoundException);
    });

    it('rejects with 400 when numGuests exceeds the room type capacity', async () => {
      roomTypeRepo.findOne.mockResolvedValue(roomType);

      await expect(service.findAvailableRoom({ ...availDto, numGuests: 5 })).rejects.toThrow(
        BadRequestException,
      );
      expect(roomRepo.find).not.toHaveBeenCalled();
    });

    it('rejects with 404 when no Available room of that type is free for the dates', async () => {
      roomTypeRepo.findOne.mockResolvedValue(roomType);
      roomRepo.find.mockResolvedValue([
        { roomId: 1, roomNumber: '301', status: RoomStatus.Available },
      ]);
      bookingRepo.createQueryBuilder.mockReturnValue(
        makeOverlapQueryBuilder([
          { status: BookingStatus.Reserved, lockExpiresAt: null } as Booking,
        ]),
      );

      await expect(service.findAvailableRoom(availDto)).rejects.toThrow(NotFoundException);
    });

    it('returns the lowest-roomId free room with correct pricing when multiple rooms are free', async () => {
      roomTypeRepo.findOne.mockResolvedValue(roomType);
      roomRepo.find.mockResolvedValue([
        { roomId: 1, roomNumber: '301', status: RoomStatus.Available },
        { roomId: 2, roomNumber: '302', status: RoomStatus.Available },
      ]);
      bookingRepo.createQueryBuilder.mockReturnValue(makeOverlapQueryBuilder([]));

      const result = await service.findAvailableRoom(availDto);

      expect(result).toEqual({
        roomId: 1,
        roomNumber: '301',
        roomTypeId: 1,
        typeName: 'Sea View Suite',
        pricePerNight: 4500,
        capacity: 2,
        nights: 3,
        totalPrice: 13500,
      });
    });

    it('does not let a stale Draft (lockExpiresAt in the past) block a match', async () => {
      roomTypeRepo.findOne.mockResolvedValue(roomType);
      roomRepo.find.mockResolvedValue([
        { roomId: 1, roomNumber: '301', status: RoomStatus.Available },
      ]);
      const staleDraft: Partial<Booking> = {
        status: BookingStatus.Draft,
        lockExpiresAt: new Date(Date.now() - 60_000),
      };
      bookingRepo.createQueryBuilder.mockReturnValue(
        makeOverlapQueryBuilder([staleDraft as Booking]),
      );

      const result = await service.findAvailableRoom(availDto);

      expect(result.roomId).toBe(1);
    });

    it('lets a genuinely active Reserved/CheckedIn/non-stale-Draft booking block that room', async () => {
      roomTypeRepo.findOne.mockResolvedValue(roomType);
      roomRepo.find.mockResolvedValue([
        { roomId: 1, roomNumber: '301', status: RoomStatus.Available },
      ]);
      const activeDraft: Partial<Booking> = {
        status: BookingStatus.Draft,
        lockExpiresAt: new Date(Date.now() + 60_000),
      };
      bookingRepo.createQueryBuilder.mockReturnValue(
        makeOverlapQueryBuilder([activeDraft as Booking]),
      );

      await expect(service.findAvailableRoom(availDto)).rejects.toThrow(NotFoundException);
    });

    it('excludes rooms already filtered to Maintenance/OutOfService status even with zero booking conflicts', async () => {
      roomTypeRepo.findOne.mockResolvedValue(roomType);
      // Simulates the repo query already filtering on status = Available: a Maintenance/OutOfService
      // room never even appears in the candidate list, so it can never be returned as a match.
      roomRepo.find.mockResolvedValue([]);

      await expect(service.findAvailableRoom(availDto)).rejects.toThrow(NotFoundException);
      expect(roomRepo.find).toHaveBeenCalledWith({
        where: { roomTypeId: 1, status: RoomStatus.Available },
        order: { roomId: 'ASC' },
      });
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

  describe('findById', () => {
    const fullBooking: Partial<Booking> = {
      bookingId: 42,
      guest: { guestId: 1, firstName: 'A', lastName: 'B', phone: '089-1', email: null },
      room: {
        roomId: 1,
        roomTypeId: 1,
        roomNumber: '301',
        roomType: { roomTypeId: 1, typeName: 'Sea View Suite', pricePerNight: 4500, capacity: 2 },
      } as Room,
      checkIn: '2026-07-10',
      checkOut: '2026-07-13',
      numGuests: 2,
      totalPrice: 13500,
      status: BookingStatus.Reserved,
      lockExpiresAt: null,
      paymentNote: 'PromptPay 08/07 14:32',
      slipImagePath: '/app/uploads/slips/abc123.jpg',
      paymentConfirmedBy: 5,
      paymentConfirmedAt: new Date('2026-07-07'),
      specialRequest: null,
      createdBy: null,
      createdAt: new Date('2026-07-06'),
      updatedAt: new Date('2026-07-07'),
    };

    it('throws NotFoundException when the booking does not exist', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(42)).rejects.toThrow(NotFoundException);
    });

    it('never leaks the raw slipImagePath filesystem path, exposing only a hasSlip boolean', async () => {
      bookingRepo.findOne.mockResolvedValue(fullBooking as Booking);

      const result = await service.findById(42);

      expect(result).not.toHaveProperty('slipImagePath');
      expect(JSON.stringify(result)).not.toContain('/app/uploads/slips');
      expect(result.hasSlip).toBe(true);
      expect(result.bookingId).toBe(42);
      expect(result.guest.guestId).toBe(1);
      expect(result.room.roomType.typeName).toBe('Sea View Suite');
    });
  });

  describe('confirmPayment', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    const notAnImageBuffer = Buffer.from('this is just text, not an image');
    const confirmDto = { paymentNote: 'PromptPay 08/07 14:32' };

    it('throws NotFoundException when the booking does not exist', async () => {
      manager.createQueryBuilder.mockReturnValue(makeSingleRowQueryBuilder(null));

      await expect(
        service.confirmPayment(99, { buffer: jpegBuffer, size: jpegBuffer.length }, confirmDto, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the booking is not in Draft status', async () => {
      manager.createQueryBuilder.mockReturnValue(
        makeSingleRowQueryBuilder({
          bookingId: 1,
          status: BookingStatus.Reserved,
        } as Booking),
      );

      await expect(
        service.confirmPayment(1, { buffer: jpegBuffer, size: jpegBuffer.length }, confirmDto, 1),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects content that is not a recognized image, regardless of declared content', async () => {
      manager.createQueryBuilder.mockReturnValue(
        makeSingleRowQueryBuilder({ bookingId: 1, status: BookingStatus.Draft } as Booking),
      );

      await expect(
        service.confirmPayment(
          1,
          { buffer: notAnImageBuffer, size: notAnImageBuffer.length },
          confirmDto,
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a file exceeding the configured size limit', async () => {
      manager.createQueryBuilder.mockReturnValue(
        makeSingleRowQueryBuilder({ bookingId: 1, status: BookingStatus.Draft } as Booking),
      );

      await expect(
        service.confirmPayment(1, { buffer: jpegBuffer, size: 6 * 1024 * 1024 }, confirmDto, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('confirms payment: writes the slip, updates the booking to Reserved, and logs a BookingLog row', async () => {
      manager.createQueryBuilder.mockReturnValue(
        makeSingleRowQueryBuilder({
          bookingId: 1,
          status: BookingStatus.Draft,
          lockExpiresAt: new Date(),
        } as Booking),
      );
      manager.save.mockImplementation((_entity, data) => Promise.resolve({ ...data }));

      const result = await service.confirmPayment(
        1,
        { buffer: jpegBuffer, size: jpegBuffer.length },
        confirmDto,
        7,
      );

      expect(result.status).toBe(BookingStatus.Reserved);
      expect(result.bookingId).toBe(1);
      expect(result.paymentConfirmedBy).toBe(7);
      expect(result.hasSlip).toBe(true);
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('uploads'),
        jpegBuffer,
      );
      const bookingLogSaveCall = manager.save.mock.calls.find((c) => c[0] === BookingLog);
      expect(bookingLogSaveCall[1]).toMatchObject({
        bookingId: 1,
        oldStatus: BookingStatus.Draft,
        newStatus: BookingStatus.Reserved,
        changedBy: 7,
        note: confirmDto.paymentNote,
      });
    });
  });

  describe('getSlipStream', () => {
    it('throws NotFoundException when the booking does not exist', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(service.getSlipStream(99)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the booking has no slip uploaded', async () => {
      bookingRepo.findOne.mockResolvedValue({ bookingId: 1, slipImagePath: null });

      await expect(service.getSlipStream(1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the slip file is missing on disk', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 1,
        slipImagePath: '/uploads/slips/abc.jpg',
      });
      (fsPromises.access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

      await expect(service.getSlipStream(1)).rejects.toThrow(NotFoundException);
    });

    it('returns a read stream and the MIME type derived from the stored filename extension', async () => {
      bookingRepo.findOne.mockResolvedValue({
        bookingId: 1,
        slipImagePath: '/uploads/slips/abc.jpg',
      });

      const result = await service.getSlipStream(1);

      expect(result.mimeType).toBe('image/jpeg');
      expect(fs.createReadStream).toHaveBeenCalledWith(expect.stringContaining('abc.jpg'));
    });
  });
});
