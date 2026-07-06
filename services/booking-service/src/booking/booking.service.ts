import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { LockService } from '../booking-lock/lock.service';
import { CreateDraftBookingDto } from './dto/create-draft-booking.dto';
import { CreateDraftResponseDto } from './dto/create-draft-response.dto';
import { FindAllBookingsDto } from './dto/find-all-bookings.dto';
import { LookupBookingDto } from './dto/lookup-booking.dto';
import { LookupBookingResponseDto } from './dto/lookup-booking-response.dto';
import { BookingLog } from './entities/booking-log.entity';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Guest } from './entities/guest.entity';
import { Room } from './entities/room.entity';

const ACTIVE_STATUSES: BookingStatus[] = [
  BookingStatus.Draft,
  BookingStatus.Reserved,
  BookingStatus.CheckedIn,
];

@Injectable()
export class BookingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly lockService: LockService,
    private readonly config: ConfigService,
    private readonly securityLogger: SecurityLogger,
  ) {}

  async createDraft(dto: CreateDraftBookingDto): Promise<CreateDraftResponseDto> {
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);
    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const guest = await manager.findOne(Guest, { where: { guestId: dto.guestId } });
      if (!guest) {
        throw new NotFoundException('Guest not found');
      }

      const room = await manager.findOne(Room, {
        where: { roomId: dto.roomId },
        relations: ['roomType'],
      });
      if (!room) {
        throw new NotFoundException('Room not found');
      }

      if (dto.numGuests > room.roomType.capacity) {
        throw new BadRequestException(
          `num_guests (${dto.numGuests}) exceeds room capacity (${room.roomType.capacity})`,
        );
      }

      // Locks every row that could possibly overlap for this room — this row lock is
      // what actually serializes concurrent draft-creation attempts for the same room.
      const candidates = await manager
        .createQueryBuilder(Booking, 'booking')
        .setLock('pessimistic_write')
        .where('booking.roomId = :roomId', { roomId: dto.roomId })
        .andWhere('booking.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
        .andWhere('booking.checkIn < :checkOut', { checkOut: dto.checkOut })
        .andWhere('booking.checkOut > :checkIn', { checkIn: dto.checkIn })
        .getMany();

      const now = new Date();
      const stillBlocking: Booking[] = [];
      for (const candidate of candidates) {
        const isStaleDraft =
          candidate.status === BookingStatus.Draft &&
          candidate.lockExpiresAt !== null &&
          candidate.lockExpiresAt < now;

        if (isStaleDraft) {
          // Self-heal: expire it inline instead of making this guest wait for the cron job.
          candidate.status = BookingStatus.Expired;
          candidate.lockExpiresAt = null;
          await manager.save(Booking, candidate);
          await manager.save(BookingLog, {
            bookingId: candidate.bookingId,
            oldStatus: BookingStatus.Draft,
            newStatus: BookingStatus.Expired,
            changedBy: null,
            note: 'Draft lock expired (self-healed on new booking attempt)',
          });
          this.securityLogger.log('booking_draft_self_healed_expiry', {
            bookingId: candidate.bookingId,
          });
        } else {
          stillBlocking.push(candidate);
        }
      }

      if (stillBlocking.length > 0) {
        const earliestExpiry = stillBlocking.reduce<Date | null>((earliest, b) => {
          if (!b.lockExpiresAt) return earliest;
          if (!earliest || b.lockExpiresAt < earliest) return b.lockExpiresAt;
          return earliest;
        }, null);
        this.securityLogger.warn('booking_draft_conflict', {
          roomId: dto.roomId,
          checkIn: dto.checkIn,
          checkOut: dto.checkOut,
          blockingBookingIds: stillBlocking.map((b) => b.bookingId),
        });
        throw new ConflictException({
          message: 'Room being booked, try in 15 min or pick another',
          lockExpiresAt: earliestExpiry,
        });
      }

      const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const totalPrice = Number(room.roomType.pricePerNight) * nights;
      const lockMinutes = this.config.get<number>('BOOKING_DRAFT_LOCK_MINUTES') as number;
      const lockExpiresAt = new Date(now.getTime() + lockMinutes * 60 * 1000);

      const booking = manager.create(Booking, {
        guestId: dto.guestId,
        roomId: dto.roomId,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        numGuests: dto.numGuests,
        totalPrice,
        status: BookingStatus.Draft,
        lockExpiresAt,
        specialRequest: dto.specialRequest ?? null,
      });
      const saved = await manager.save(Booking, booking);

      await manager.save(BookingLog, {
        bookingId: saved.bookingId,
        oldStatus: null,
        newStatus: BookingStatus.Draft,
        changedBy: null,
        note: 'Draft created by guest',
      });

      return saved;
    });

    // Best-effort cache write, after commit — never blocks or reverts the booking on failure.
    try {
      const lockMinutes = this.config.get<number>('BOOKING_DRAFT_LOCK_MINUTES') as number;
      await this.lockService.setLock(dto.roomId, lockMinutes * 60);
    } catch {
      // Redis is a non-authoritative cache; a failure here must never fail the request.
    }

    this.securityLogger.log('booking_draft_created', {
      bookingId: result.bookingId,
      guestId: dto.guestId,
      roomId: dto.roomId,
    });

    return {
      bookingId: result.bookingId,
      reference: this.toReference(result),
      lockExpiresAt: result.lockExpiresAt as Date,
      totalPrice: Number(result.totalPrice),
    };
  }

  async lookup(dto: LookupBookingDto): Promise<LookupBookingResponseDto> {
    const match = /^BK-(\d{4})-(\d{6})$/.exec(dto.reference);
    if (!match) {
      throw new NotFoundException('Booking not found');
    }
    const bookingId = Number(match[2]);

    const booking = await this.bookingRepo.findOne({
      where: { bookingId },
      relations: ['guest', 'room', 'room.roomType'],
    });

    // Roundtrip-validate the reference (rather than trusting the parsed year) and check
    // the second factor — a mismatch on either yields an identical 404, never a hint
    // about which part was wrong.
    const contactMatches =
      booking && (booking.guest.phone === dto.contact || booking.guest.email === dto.contact);
    if (!booking || this.toReference(booking) !== dto.reference || !contactMatches) {
      this.securityLogger.warn('booking_lookup_failure', { reference: dto.reference });
      throw new NotFoundException('Booking not found');
    }

    return {
      reference: this.toReference(booking),
      status: booking.status,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      roomNumber: booking.room.roomNumber,
      roomType: booking.room.roomType.typeName,
      totalPrice: Number(booking.totalPrice),
    };
  }

  async findAll(filters: FindAllBookingsDto): Promise<Booking[]> {
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.guest', 'guest')
      .leftJoinAndSelect('booking.room', 'room');

    if (filters.status) {
      qb.andWhere('booking.status = :status', { status: filters.status });
    }
    if (filters.roomId) {
      qb.andWhere('booking.roomId = :roomId', { roomId: filters.roomId });
    }
    if (filters.checkInFrom) {
      qb.andWhere('booking.checkIn >= :checkInFrom', { checkInFrom: filters.checkInFrom });
    }
    if (filters.checkInTo) {
      qb.andWhere('booking.checkIn <= :checkInTo', { checkInTo: filters.checkInTo });
    }

    return qb.getMany();
  }

  async findById(bookingId: number): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { bookingId },
      relations: ['guest', 'room', 'room.roomType'],
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  private toReference(booking: Booking): string {
    const year = booking.createdAt ? booking.createdAt.getFullYear() : new Date().getFullYear();
    return `BK-${year}-${String(booking.bookingId).padStart(6, '0')}`;
  }
}
