import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingModule } from './booking/booking.module';
import { BookingLog } from './booking/entities/booking-log.entity';
import { Booking } from './booking/entities/booking.entity';
import { Guest } from './booking/entities/guest.entity';
import { Room } from './booking/entities/room.entity';
import { RoomType } from './booking/entities/room-type.entity';
import { configSchema } from './config/config.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configSchema,
      validationOptions: { abortEarly: false },
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        entities: [Booking, BookingLog, Guest, Room, RoomType],
        synchronize: false,
      }),
    }),
    BookingModule,
  ],
})
export class AppModule {}
