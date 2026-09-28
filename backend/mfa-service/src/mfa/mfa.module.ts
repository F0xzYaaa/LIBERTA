import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { AuthClientService } from './auth-client.service';
import { BackupCode } from './entities/backup-code.entity';
import { Employee } from './entities/employee.entity';
import { MFASecret } from './entities/mfa-secret.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { redisProvider } from './redis/redis.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, MFASecret, BackupCode]),
    PassportModule,
    HttpModule,
  ],
  controllers: [MfaController],
  providers: [MfaService, AuthClientService, redisProvider, JwtStrategy, SecurityLogger],
})
export class MfaModule {}
