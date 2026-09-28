import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { BookingLog } from '../booking/entities/booking-log.entity';
import { Booking, BookingStatus } from '../booking/entities/booking.entity';
import { LockService } from './lock.service';

/**
 * Backstop for Drafts nobody ever retries against — the inline self-heal in
 * BookingService.createDraft handles the common case immediately; this only
 * catches abandoned Drafts within roughly 60s of their lock lapsing.
 */
@Injectable()
export class ExpiryCronService {
  private readonly logger = new Logger(ExpiryCronService.name);

  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingLog) private readonly bookingLogRepo: Repository<BookingLog>,
    private readonly lockService: LockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleDrafts(): Promise<void> {
    const staleDrafts = await this.bookingRepo.find({
      where: { status: BookingStatus.Draft, lockExpiresAt: LessThan(new Date()) },
    });

    for (const draft of staleDrafts) {
      draft.status = BookingStatus.Expired;
      draft.lockExpiresAt = null;
      await this.bookingRepo.save(draft);

      await this.bookingLogRepo.save({
        bookingId: draft.bookingId,
        oldStatus: BookingStatus.Draft,
        newStatus: BookingStatus.Expired,
        changedBy: null,
        note: 'Draft lock expired (background cron)',
      });

      try {
        await this.lockService.clearLock(draft.roomId);
      } catch {
        // Non-authoritative cache — a cleanup failure here is not fatal.
      }
    }

    if (staleDrafts.length > 0) {
      this.logger.log(`Expired ${staleDrafts.length} stale draft booking(s)`);
    }
  }
}
