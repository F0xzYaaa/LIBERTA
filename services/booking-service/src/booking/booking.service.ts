import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createReadStream, ReadStream } from 'fs';
import { access, mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { LockService } from '../booking-lock/lock.service';
import { AvailableRoomResponseDto } from './dto/available-room-response.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { ConfirmPaymentResponseDto } from './dto/confirm-payment-response.dto';
import { CreateDraftBookingDto } from './dto/create-draft-booking.dto';
import { CreateDraftResponseDto } from './dto/create-draft-response.dto';
import { FindAllBookingsDto } from './dto/find-all-bookings.dto';
import { FindAvailableRoomDto } from './dto/find-available-room.dto';
import { LookupBookingDto } from './dto/lookup-booking.dto';
import { LookupBookingResponseDto } from './dto/lookup-booking-response.dto';
import { BookingLog } from './entities/booking-log.entity';
import { Booking, BookingStatus } from './entities/booking.entity';
import { Guest } from './entities/guest.entity';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';

const ACTIVE_STATUSES: BookingStatus[] = [
  BookingStatus.Draft,
  BookingStatus.Reserved,
  BookingStatus.CheckedIn,
];

export interface UploadedSlipFile {
  buffer: Buffer;
  size: number;
}

// Duplicated from room-service's room-image.service.ts — sniffs actual file content
// instead of trusting the client-supplied MIME type / extension.
const SLIP_MAGIC_BYTES: Record<string, { ext: string; check: (buf: Buffer) => boolean }> = {
  'image/jpeg': {
    ext: 'jpg',
    check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  'image/png': {
    ext: 'png',
    check: (buf) =>
      buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  },
  'image/webp': {
    ext: 'webp',
    check: (buf) =>
      buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP',
  },
};

// Content-Type is derived from the server-generated filename extension on read,
// never re-sniffed from disk and never trusted from the client.
const SLIP_EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

@Injectable()
export class BookingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomType) private readonly roomTypeRepo: Repository<RoomType>,
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
      // Relies on InnoDB's default REPEATABLE READ isolation: because this WHERE clause
      // is a range scan (not an equality match on a unique index), MySQL takes gap/next-key
      // locks across the scanned range, not just locks on existing rows. That's what stops
      // a second transaction from inserting a new overlapping booking into the "gap" between
      // this SELECT...FOR UPDATE and this transaction's commit — do not change the isolation
      // level to READ COMMITTED without re-verifying this invariant, since gap locking is
      // weaker there and could reopen the double-booking race this query exists to prevent.
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

  // Read-only resolver/preview: reuses createDraft's overlap-conflict semantics (including the
  // stale-Draft-does-not-block rule) but takes no row lock and starts no transaction. It is NOT
  // the authoritative gate against double-booking — createDraft's SELECT...FOR UPDATE remains
  // the only thing that actually prevents two guests from locking the same room. Also filters out
  // Room.status Maintenance/OutOfService (and anything not Available), which createDraft
  // intentionally does not check today.
  async findAvailableRoom(dto: FindAvailableRoomDto): Promise<AvailableRoomResponseDto> {
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);
    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const roomType = await this.roomTypeRepo.findOne({ where: { roomTypeId: dto.roomTypeId } });
    if (!roomType) {
      throw new NotFoundException('No available room of this type for the given dates');
    }

    if (dto.numGuests !== undefined && dto.numGuests > roomType.capacity) {
      throw new BadRequestException(
        `numGuests (${dto.numGuests}) exceeds room type capacity (${roomType.capacity})`,
      );
    }

    const candidateRooms = await this.roomRepo.find({
      where: { roomTypeId: dto.roomTypeId, status: RoomStatus.Available },
      order: { roomId: 'ASC' },
    });

    const now = new Date();
    for (const room of candidateRooms) {
      const overlapping = await this.bookingRepo
        .createQueryBuilder('booking')
        .where('booking.roomId = :roomId', { roomId: room.roomId })
        .andWhere('booking.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
        .andWhere('booking.checkIn < :checkOut', { checkOut: dto.checkOut })
        .andWhere('booking.checkOut > :checkIn', { checkIn: dto.checkIn })
        .getMany();

      const isBlocked = overlapping.some((booking) => {
        const isStaleDraft =
          booking.status === BookingStatus.Draft &&
          booking.lockExpiresAt !== null &&
          booking.lockExpiresAt < now;
        return !isStaleDraft;
      });

      if (!isBlocked) {
        const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const pricePerNight = Number(roomType.pricePerNight);
        return {
          roomId: room.roomId,
          roomNumber: room.roomNumber,
          roomTypeId: roomType.roomTypeId,
          typeName: roomType.typeName,
          pricePerNight,
          capacity: roomType.capacity,
          nights,
          totalPrice: pricePerNight * nights,
        };
      }
    }

    throw new NotFoundException('No available room of this type for the given dates');
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

  async findAll(filters: FindAllBookingsDto): Promise<BookingResponseDto[]> {
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.guest', 'guest')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('room.roomType', 'roomType');

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

    const bookings = await qb.getMany();
    return bookings.map((booking) => this.toBookingResponse(booking));
  }

  async findById(bookingId: number): Promise<BookingResponseDto> {
    const booking = await this.bookingRepo.findOne({
      where: { bookingId },
      relations: ['guest', 'room', 'room.roomType'],
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return this.toBookingResponse(booking);
  }

  // Whitelists the fields Staff/Admin are allowed to see for a booking —
  // notably excludes slipImagePath (raw filesystem path), which must only
  // ever be reachable through the authenticated GET /bookings/:id/slip endpoint.
  private toBookingResponse(booking: Booking): BookingResponseDto {
    return {
      bookingId: booking.bookingId,
      guest: {
        guestId: booking.guest.guestId,
        firstName: booking.guest.firstName,
        lastName: booking.guest.lastName,
        phone: booking.guest.phone,
        email: booking.guest.email,
      },
      room: {
        roomId: booking.room.roomId,
        roomNumber: booking.room.roomNumber,
        roomType: {
          roomTypeId: booking.room.roomType.roomTypeId,
          typeName: booking.room.roomType.typeName,
          pricePerNight: booking.room.roomType.pricePerNight,
        },
      },
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      numGuests: booking.numGuests,
      totalPrice: booking.totalPrice,
      status: booking.status,
      lockExpiresAt: booking.lockExpiresAt,
      paymentNote: booking.paymentNote,
      hasSlip: booking.slipImagePath !== null,
      paymentConfirmedBy: booking.paymentConfirmedBy,
      paymentConfirmedAt: booking.paymentConfirmedAt,
      specialRequest: booking.specialRequest,
      createdBy: booking.createdBy,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }

  async confirmPayment(
    bookingId: number,
    file: UploadedSlipFile,
    dto: ConfirmPaymentDto,
    actingEmployeeId: number,
  ): Promise<ConfirmPaymentResponseDto> {
    const saved = await this.dataSource.transaction(async (manager) => {
      // Row lock serializes concurrent confirm attempts against the same booking.
      const booking = await manager
        .createQueryBuilder(Booking, 'booking')
        .setLock('pessimistic_write')
        .where('booking.bookingId = :bookingId', { bookingId })
        .getOne();

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }
      if (booking.status !== BookingStatus.Draft) {
        throw new ConflictException(
          `Booking is not in Draft status (current status: ${booking.status})`,
        );
      }

      const maxSize = this.config.get<number>('BOOKING_SLIP_MAX_SIZE_BYTES') as number;
      if (file.size > maxSize) {
        throw new BadRequestException(`File exceeds the maximum size of ${maxSize} bytes`);
      }

      const detected = Object.entries(SLIP_MAGIC_BYTES).find(([, spec]) => spec.check(file.buffer));
      if (!detected) {
        throw new BadRequestException('File is not a recognized JPEG, PNG, or WebP image');
      }
      const [, spec] = detected;

      const uploadDir = this.config.get<string>('BOOKING_SLIP_UPLOAD_DIR') as string;
      await mkdir(uploadDir, { recursive: true });

      // Filename is always server-generated — the client-supplied filename is never used
      // for the on-disk path, closing off path traversal entirely.
      const filename = `${randomUUID()}.${spec.ext}`;
      await writeFile(path.join(uploadDir, filename), file.buffer);

      booking.paymentNote = dto.paymentNote;
      booking.slipImagePath = `/uploads/slips/${filename}`;
      booking.paymentConfirmedBy = actingEmployeeId;
      booking.paymentConfirmedAt = new Date();
      booking.status = BookingStatus.Reserved;
      booking.lockExpiresAt = null;
      const updated = await manager.save(Booking, booking);

      await manager.save(BookingLog, {
        bookingId: updated.bookingId,
        oldStatus: BookingStatus.Draft,
        newStatus: BookingStatus.Reserved,
        changedBy: actingEmployeeId,
        note: dto.paymentNote,
      });

      return updated;
    });

    this.securityLogger.log('admin_action_payment_confirmed', {
      bookingId: saved.bookingId,
      actingEmployeeId,
    });

    return {
      bookingId: saved.bookingId,
      status: saved.status,
      paymentConfirmedAt: saved.paymentConfirmedAt as Date,
      paymentConfirmedBy: saved.paymentConfirmedBy as number,
      hasSlip: true,
    };
  }

  async getSlipStream(bookingId: number): Promise<{ stream: ReadStream; mimeType: string }> {
    const booking = await this.bookingRepo.findOne({ where: { bookingId } });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (!booking.slipImagePath) {
      throw new NotFoundException('No payment slip uploaded for this booking');
    }

    const filename = path.basename(booking.slipImagePath);
    const ext = path.extname(filename).slice(1).toLowerCase();
    const mimeType = SLIP_EXT_TO_MIME[ext];
    if (!mimeType) {
      throw new NotFoundException('Slip file type not recognized');
    }

    const uploadDir = this.config.get<string>('BOOKING_SLIP_UPLOAD_DIR') as string;
    const fullPath = path.join(uploadDir, filename);
    try {
      await access(fullPath);
    } catch {
      throw new NotFoundException('Slip file missing on disk');
    }

    return { stream: createReadStream(fullPath), mimeType };
  }

  private toReference(booking: Booking): string {
    const year = booking.createdAt ? booking.createdAt.getFullYear() : new Date().getFullYear();
    return `BK-${year}-${String(booking.bookingId).padStart(6, '0')}`;
  }
}
