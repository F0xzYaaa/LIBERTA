import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { SecurityLogger } from '../common/security-logger.service';
import { Room } from '../room/entities/room.entity';
import { RoomImage } from './entities/room-image.entity';
import { RoomImageController } from './room-image.controller';
import { RoomImageService } from './room-image.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoomImage, Room]), PassportModule],
  controllers: [RoomImageController],
  providers: [RoomImageService, JwtStrategy, SecurityLogger],
})
export class RoomImageModule {}
