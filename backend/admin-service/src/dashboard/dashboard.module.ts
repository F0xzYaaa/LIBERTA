import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { redisProvider } from '../cache/redis.provider';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Booking } from './entities/booking.entity';
import { Employee } from './entities/employee.entity';
import { Guest } from './entities/guest.entity';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Room, RoomType, Guest, Employee]), PassportModule],
  controllers: [DashboardController],
  providers: [DashboardService, JwtStrategy, redisProvider],
})
export class DashboardModule {}
