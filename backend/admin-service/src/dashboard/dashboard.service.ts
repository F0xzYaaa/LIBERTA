import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { In, Not, Repository } from 'typeorm';
import { REDIS_CLIENT } from '../cache/redis.provider';
import { BookingsByStatusResponseDto } from './dto/bookings-by-status-response.dto';
import { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto';
import { OccupancyQueryDto } from './dto/occupancy-query.dto';
import { OccupancyDayDto, OccupancyResponseDto } from './dto/occupancy-response.dto';
import { RevenueGroupBy, RevenueQueryDto } from './dto/revenue-query.dto';
import { RevenueResponseDto } from './dto/revenue-response.dto';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Room, RoomStatus } from './entities/room.entity';

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.Reserved, BookingStatus.CheckedIn];
const MAX_DATE_RANGE_DAYS = 366;

const EMPTY_STATUS_COUNTS: BookingsByStatusResponseDto = {
  Draft: 0,
  Reserved: 0,
  CheckedIn: 0,
  CheckedOut: 0,
  Cancelled: 0,
  NoShow: 0,
  Expired: 0,
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async getSummary(): Promise<DashboardSummaryResponseDto> {
    const today = this.todayDateString();
    const cacheKey = `admin:dashboard:summary:${today}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as DashboardSummaryResponseDto;
    }

    const [
      arrivalsToday,
      departuresToday,
      pendingPaymentConfirmations,
      occupiedRoomsToday,
      totalActiveRooms,
      revenueRow,
    ] = await Promise.all([
      this.bookingRepo.count({
        where: { checkIn: today, status: In(ACTIVE_BOOKING_STATUSES) },
      }),
      this.bookingRepo.count({
        where: { checkOut: today, status: In([BookingStatus.CheckedIn, BookingStatus.CheckedOut]) },
      }),
      this.bookingRepo
        .createQueryBuilder('booking')
        .where('booking.status = :status', { status: BookingStatus.Draft })
        .andWhere('booking.lockExpiresAt > :now', { now: new Date() })
        .getCount(),
      this.countOccupiedRooms(today),
      this.roomRepo.count({ where: { status: Not(RoomStatus.OutOfService) } }),
      this.bookingRepo
        .createQueryBuilder('booking')
        .select('SUM(booking.totalPrice)', 'sum')
        .where('DATE(booking.paymentConfirmedAt) = :today', { today })
        .getRawOne<{ sum: string | null }>(),
    ]);

    const result: DashboardSummaryResponseDto = {
      arrivalsToday,
      departuresToday,
      pendingPaymentConfirmations,
      occupiedRoomsToday,
      totalActiveRooms,
      occupancyRatePercent: this.toPercent(occupiedRoomsToday, totalActiveRooms),
      revenueTodayConfirmed: Number(revenueRow?.sum ?? 0),
    };

    const ttlSeconds = this.config.get<number>('DASHBOARD_CACHE_TTL_SECONDS') as number;
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', ttlSeconds);

    return result;
  }

  async getOccupancy(dto: OccupancyQueryDto): Promise<OccupancyResponseDto> {
    this.validateDateRange(dto.from, dto.to);

    const totalActiveRooms = await this.roomRepo.count({
      where: { status: Not(RoomStatus.OutOfService) },
    });

    const dateStrings = this.enumerateDates(dto.from, dto.to);
    const days: OccupancyDayDto[] = await Promise.all(
      dateStrings.map(async (date) => {
        const occupiedRooms = await this.countOccupiedRooms(date);
        return {
          date,
          occupiedRooms,
          totalActiveRooms,
          occupancyRatePercent: this.toPercent(occupiedRooms, totalActiveRooms),
        };
      }),
    );

    return { from: dto.from, to: dto.to, days };
  }

  async getRevenue(dto: RevenueQueryDto): Promise<RevenueResponseDto> {
    this.validateDateRange(dto.from, dto.to);

    const periodExpr =
      dto.groupBy === RevenueGroupBy.Month
        ? "DATE_FORMAT(booking.paymentConfirmedAt, '%Y-%m')"
        : "DATE_FORMAT(booking.paymentConfirmedAt, '%Y-%m-%d')";

    const rows = await this.bookingRepo
      .createQueryBuilder('booking')
      .select(periodExpr, 'period')
      .addSelect('SUM(booking.totalPrice)', 'revenue')
      .where('booking.paymentConfirmedAt IS NOT NULL')
      .andWhere('DATE(booking.paymentConfirmedAt) BETWEEN :from AND :to', {
        from: dto.from,
        to: dto.to,
      })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{ period: string; revenue: string }>();

    return {
      from: dto.from,
      to: dto.to,
      groupBy: dto.groupBy,
      buckets: rows.map((row) => ({ period: row.period, revenue: Number(row.revenue) })),
    };
  }

  async getBookingsByStatus(): Promise<BookingsByStatusResponseDto> {
    const rows = await this.bookingRepo
      .createQueryBuilder('booking')
      .select('booking.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('booking.status')
      .getRawMany<{ status: BookingStatus; count: string }>();

    const counts: BookingsByStatusResponseDto = { ...EMPTY_STATUS_COUNTS };
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  private async countOccupiedRooms(date: string): Promise<number> {
    const result = await this.bookingRepo
      .createQueryBuilder('booking')
      .select('COUNT(DISTINCT booking.roomId)', 'count')
      .where('booking.status IN (:...statuses)', { statuses: ACTIVE_BOOKING_STATUSES })
      .andWhere('booking.checkIn <= :date', { date })
      .andWhere('booking.checkOut > :date', { date })
      .getRawOne<{ count: string }>();
    return Number(result?.count ?? 0);
  }

  private toPercent(part: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((part / total) * 10000) / 100;
  }

  private todayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private enumerateDates(from: string, to: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }

  private validateDateRange(from: string, to: string): void {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);

    if (toDate < fromDate) {
      throw new BadRequestException('to must not be before from');
    }

    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > MAX_DATE_RANGE_DAYS) {
      throw new BadRequestException(`Date range must not exceed ${MAX_DATE_RANGE_DAYS} days`);
    }
  }
}
