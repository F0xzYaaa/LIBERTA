import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { SecurityLogger } from '../common/security-logger.service';
import { Room } from './entities/room.entity';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';

@Module({
  imports: [TypeOrmModule.forFeature([Room]), PassportModule],
  controllers: [RoomController],
  providers: [RoomService, JwtStrategy, SecurityLogger],
})
export class RoomModule {}
