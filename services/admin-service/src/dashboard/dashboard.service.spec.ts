import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { REDIS_CLIENT } from '../cache/redis.provider';
import { DashboardService } from './dashboard.service';
import { Booking } from './entities/booking.entity';
import { Room } from './entities/room.entity';

describe('DashboardService', () => {
  let service: DashboardService;
  let bookingRepo: { count: jest.Mock; createQueryBuilder: jest.Mock };
  let roomRepo: { count: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock };
  let config: { get: jest.Mock };

  function makeQueryBuilder(overrides: {
    getCount?: number;
    getRawOne?: unknown;
    getRawMany?: unknown[];
  }) {
    return {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(overrides.getCount ?? 0),
      getRawOne: jest.fn().mockResolvedValue(overrides.getRawOne ?? null),
      getRawMany: jest.fn().mockResolvedValue(overrides.getRawMany ?? []),
    };
  }

  beforeEach(async () => {
    bookingRepo = { count: jest.fn(), createQueryBuilder: jest.fn() };
    roomRepo = { count: jest.fn() };
    redis = { get: jest.fn(), set: jest.fn() };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, number> = { DASHBOARD_CACHE_TTL_SECONDS: 60 };
        return values[key];
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Room), useValue: roomRepo },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  describe('getSummary', () => {
    it('returns the cached summary without querying MySQL when present in Redis', async () => {
      const cached = {
        arrivalsToday: 1,
        departuresToday: 2,
        pendingPaymentConfirmations: 3,
        occupiedRoomsToday: 4,
        totalActiveRooms: 10,
        occupancyRatePercent: 40,
        revenueTodayConfirmed: 5000,
      };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getSummary();

      expect(result).toEqual(cached);
      expect(bookingRepo.count).not.toHaveBeenCalled();
    });

    it('computes the summary from MySQL and caches it when Redis has no entry', async () => {
      redis.get.mockResolvedValue(null);
      bookingRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      roomRepo.count.mockResolvedValue(10);
      bookingRepo.createQueryBuilder
        .mockReturnValueOnce(makeQueryBuilder({ getCount: 3 }))
        .mockReturnValueOnce(makeQueryBuilder({ getRawOne: { count: '4' } }))
        .mockReturnValueOnce(makeQueryBuilder({ getRawOne: { sum: '15000.00' } }));

      const result = await service.getSummary();

      expect(result.arrivalsToday).toBe(2);
      expect(result.departuresToday).toBe(1);
      expect(result.pendingPaymentConfirmations).toBe(3);
      expect(result.occupiedRoomsToday).toBe(4);
      expect(result.totalActiveRooms).toBe(10);
      expect(result.occupancyRatePercent).toBe(40);
      expect(result.revenueTodayConfirmed).toBe(15000);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('admin:dashboard:summary:'),
        expect.any(String),
        'EX',
        60,
      );
    });
  });

  describe('getOccupancy', () => {
    it('rejects a range where to is before from', async () => {
      await expect(service.getOccupancy({ from: '2026-07-10', to: '2026-07-01' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a range spanning more than 366 days', async () => {
      await expect(service.getOccupancy({ from: '2020-01-01', to: '2022-01-01' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns one day entry per date in the range with the occupancy rate computed', async () => {
      roomRepo.count.mockResolvedValue(10);
      bookingRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ getRawOne: { count: '5' } }),
      );

      const result = await service.getOccupancy({ from: '2026-07-01', to: '2026-07-03' });

      expect(result.days).toHaveLength(3);
      expect(result.days[0]).toEqual({
        date: '2026-07-01',
        occupiedRooms: 5,
        totalActiveRooms: 10,
        occupancyRatePercent: 50,
      });
    });
  });

  describe('getRevenue', () => {
    it('rejects a range where to is before from', async () => {
      await expect(
        service.getRevenue({ from: '2026-07-10', to: '2026-07-01', groupBy: 'day' as never }),
      ).rejects.toThrow(BadRequestException);
    });

    it('groups confirmed revenue into buckets by the requested period', async () => {
      bookingRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          getRawMany: [
            { period: '2026-07-01', revenue: '4500.00' },
            { period: '2026-07-02', revenue: '9000.00' },
          ],
        }),
      );

      const result = await service.getRevenue({
        from: '2026-07-01',
        to: '2026-07-31',
        groupBy: 'day' as never,
      });

      expect(result.buckets).toEqual([
        { period: '2026-07-01', revenue: 4500 },
        { period: '2026-07-02', revenue: 9000 },
      ]);
    });
  });

  describe('getBookingsByStatus', () => {
    it('returns zero-filled counts for every status, overridden by actual counts where present', async () => {
      bookingRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          getRawMany: [
            { status: 'Draft', count: '2' },
            { status: 'Reserved', count: '5' },
          ],
        }),
      );

      const result = await service.getBookingsByStatus();

      expect(result).toEqual({
        Draft: 2,
        Reserved: 5,
        CheckedIn: 0,
        CheckedOut: 0,
        Cancelled: 0,
        NoShow: 0,
        Expired: 0,
      });
    });
  });
});
