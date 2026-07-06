import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { LockModule } from '../booking-lock/lock.module';
import { SecurityLogger } from '../common/security-logger.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingLog } from './entities/booking-log.entity';
import { Booking } from './entities/booking.entity';
import { Guest } from './entities/guest.entity';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingLog, Guest, Room, RoomType]),
    LockModule,
    PassportModule,
  ],
  controllers: [BookingController],
  providers: [BookingService, JwtStrategy, SecurityLogger],
})
export class BookingModule {}
