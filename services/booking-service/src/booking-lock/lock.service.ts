import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';

const LOCK_KEY_PREFIX = 'booking_lock:';

/**
 * Redis here is a non-authoritative cache, never a gate. A single per-room key
 * cannot correctly represent date-range overlap (it would false-reject bookings
 * for the same room on entirely different, non-overlapping dates), so this
 * service is never consulted to accept/reject a draft — MySQL's
 * SELECT...FOR UPDATE in BookingService is the only source of truth for that.
 * This exists purely as an observability/fast-hint cache (e.g. a future
 * "is this room likely busy right now" indicator) mirroring the DB-side
 * lock_expires_at with the same 900s TTL, set only after a successful commit.
 */
@Injectable()
export class LockService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async setLock(roomId: number, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${LOCK_KEY_PREFIX}${roomId}`, '1', 'EX', ttlSeconds);
  }

  async clearLock(roomId: number): Promise<void> {
    await this.redis.del(`${LOCK_KEY_PREFIX}${roomId}`);
  }
}
