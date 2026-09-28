import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configSchema } from './config/config.schema';
import { DashboardModule } from './dashboard/dashboard.module';
import { Booking } from './dashboard/entities/booking.entity';
import { Employee } from './dashboard/entities/employee.entity';
import { Guest } from './dashboard/entities/guest.entity';
import { Room } from './dashboard/entities/room.entity';
import { RoomType } from './dashboard/entities/room-type.entity';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configSchema,
      validationOptions: { abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        // Dedicated read-only DB user (admin_ro) — never the shared app credentials.
        // See database/grants.sql. TypeORM synchronize is disabled and this service's
        // code never calls save/insert/update/delete on any repository.
        username: config.get<string>('ADMIN_DB_USERNAME'),
        password: config.get<string>('ADMIN_DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        entities: [Booking, Room, RoomType, Guest, Employee],
        synchronize: false,
      }),
    }),
    DashboardModule,
    HealthModule,
  ],
})
export class AppModule {}
