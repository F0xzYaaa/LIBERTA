import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { AuthController } from './auth.controller';
import { AuthInternalController } from './auth.internal.controller';
import { AuthService } from './auth.service';
import { Employee } from './entities/employee.entity';
import { Role } from './entities/role.entity';
import { redisProvider } from './redis/redis.provider';
import { JwtStrategy } from './strategies/jwt.strategy';
import { InternalKeyGuard } from './guards/internal-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, Role]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES') },
      }),
    }),
  ],
  controllers: [AuthController, AuthInternalController],
  providers: [AuthService, redisProvider, JwtStrategy, InternalKeyGuard, SecurityLogger],
})
export class AuthModule {}
