import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configSchema } from './config/config.schema';
import { Room } from './room/entities/room.entity';
import { RoomModule } from './room/room.module';
import { RoomImage } from './room-image/entities/room-image.entity';
import { RoomImageModule } from './room-image/room-image.module';
import { RoomType } from './room-type/entities/room-type.entity';
import { RoomTypeModule } from './room-type/room-type.module';
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
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        entities: [RoomType, Room, RoomImage],
        synchronize: false,
      }),
    }),
    RoomTypeModule,
    RoomModule,
    RoomImageModule,
    HealthModule,
  ],
})
export class AppModule {}
