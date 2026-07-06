import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { Guest } from './entities/guest.entity';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';

@Module({
  imports: [TypeOrmModule.forFeature([Guest])],
  controllers: [GuestController],
  providers: [GuestService, SecurityLogger],
})
export class GuestModule {}
