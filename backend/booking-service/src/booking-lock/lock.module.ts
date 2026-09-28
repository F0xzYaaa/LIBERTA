import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingLog } from '../booking/entities/booking-log.entity';
import { Booking } from '../booking/entities/booking.entity';
import { ExpiryCronService } from './expiry.cron';
import { LockService } from './lock.service';
import { redisProvider } from './redis.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingLog])],
  providers: [LockService, ExpiryCronService, redisProvider],
  exports: [LockService],
})
export class LockModule {}
