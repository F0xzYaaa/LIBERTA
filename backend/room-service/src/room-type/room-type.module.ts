import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { SecurityLogger } from '../common/security-logger.service';
import { RoomType } from './entities/room-type.entity';
import { RoomTypeController } from './room-type.controller';
import { RoomTypeService } from './room-type.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoomType]), PassportModule],
  controllers: [RoomTypeController],
  providers: [RoomTypeService, JwtStrategy, SecurityLogger],
})
export class RoomTypeModule {}
