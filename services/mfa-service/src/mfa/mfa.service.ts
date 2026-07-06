import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { Repository } from 'typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { AuthClientService } from './auth-client.service';
import { AdminResetMfaDto } from './dto/admin-reset-mfa.dto';
import { GenerateMfaResponseDto } from './dto/generate-mfa-response.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { BackupCode } from './entities/backup-code.entity';
import { Employee } from './entities/employee.entity';
import { MFASecret } from './entities/mfa-secret.entity';
import { REDIS_CLIENT } from './redis/redis.provider';

const TEMP_TOKEN_PREFIX = 'temp_token:';
const ATTEMPT_PREFIX = 'mfa_attempts:';
const BCRYPT_COST = 10;
const BACKUP_CODE_COUNT = 10;

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(MFASecret) private readonly mfaSecretRepo: Repository<MFASecret>,
    @InjectRepository(BackupCode) private readonly backupCodeRepo: Repository<BackupCode>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly authClient: AuthClientService,
    private readonly config: ConfigService,
    private readonly securityLogger: SecurityLogger,
  ) {}

  async generate(tempToken: string): Promise<GenerateMfaResponseDto> {
    const employeeId = await this.resolveEmployeeIdFromTempToken(tempToken);
    this.securityLogger.log('mfa_enrollment_started', { employeeId });
    return this.enrollEmployee(employeeId);
  }

  async adminReset(
    dto: AdminResetMfaDto,
    actingEmployeeId?: number,
  ): Promise<GenerateMfaResponseDto> {
    const employee = await this.employeeRepo.findOne({ where: { employeeId: dto.employeeId } });
    if (!employee) {
      throw new UnauthorizedException('Employee not found');
    }
    await this.mfaSecretRepo.delete({ employeeId: dto.employeeId });
    await this.backupCodeRepo.delete({ employeeId: dto.employeeId });
    employee.mfaEnabled = false;
    await this.employeeRepo.save(employee);
    this.securityLogger.log('admin_action_mfa_reset', {
      actingEmployeeId,
      targetEmployeeId: dto.employeeId,
    });
    return this.enrollEmployee(dto.employeeId);
  }

  private async enrollEmployee(employeeId: number): Promise<GenerateMfaResponseDto> {
    const existing = await this.mfaSecretRepo.findOne({ where: { employeeId } });
    if (existing && existing.activatedAt) {
      throw new ConflictException(
        'MFA is already enrolled for this employee — an admin must reset it before re-enrolling',
      );
    }

    const employee = await this.employeeRepo.findOne({ where: { employeeId } });
    if (!employee) {
      throw new UnauthorizedException('Employee not found');
    }

    const secret = authenticator.generateSecret();
    const issuer = this.config.get<string>('TOTP_ISSUER') as string;
    const otpauthUrl = authenticator.keyuri(employee.username, issuer, secret);
    const qrCodeDataUri = await QRCode.toDataURL(otpauthUrl);

    if (existing) {
      existing.secret = secret;
      await this.mfaSecretRepo.save(existing);
    } else {
      await this.mfaSecretRepo.save(this.mfaSecretRepo.create({ employeeId, secret }));
    }

    const backupCodes = await this.regenerateBackupCodes(employeeId);

    return { qrCodeDataUri, manualEntryKey: secret, backupCodes };
  }

  private async regenerateBackupCodes(employeeId: number): Promise<string[]> {
    await this.backupCodeRepo.delete({ employeeId });
    const plainCodes: string[] = [];
    const entities: BackupCode[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = this.generateBackupCode();
      plainCodes.push(code);
      const codeHash = await bcrypt.hash(code, BCRYPT_COST);
      entities.push(this.backupCodeRepo.create({ employeeId, codeHash }));
    }
    await this.backupCodeRepo.save(entities);
    return plainCodes;
  }

  private generateBackupCode(): string {
    const raw = randomBytes(5).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  }

  async verifyTotp(tempToken: string, totpCode: string): Promise<TokenResponseDto> {
    const employeeId = await this.resolveEmployeeIdFromTempToken(tempToken);
    await this.enforceAttemptLimit(tempToken);

    const mfaSecret = await this.mfaSecretRepo.findOne({ where: { employeeId } });
    if (!mfaSecret) {
      throw new UnauthorizedException('MFA is not enrolled for this employee');
    }

    const isValid = authenticator.verify({ token: totpCode, secret: mfaSecret.secret });
    if (!isValid) {
      await this.recordFailedAttempt(tempToken);
      this.securityLogger.warn('mfa_verify_failure', { employeeId, method: 'totp' });
      throw new UnauthorizedException('Invalid TOTP code');
    }

    if (!mfaSecret.activatedAt) {
      mfaSecret.activatedAt = new Date();
      await this.mfaSecretRepo.save(mfaSecret);
      await this.employeeRepo.update({ employeeId }, { mfaEnabled: true });
    }

    await this.consumeTempToken(tempToken);
    this.securityLogger.log('mfa_verify_success', { employeeId, method: 'totp' });
    return this.authClient.issueTokenForEmployee(employeeId);
  }

  async verifyBackupCode(tempToken: string, backupCode: string): Promise<TokenResponseDto> {
    const employeeId = await this.resolveEmployeeIdFromTempToken(tempToken);
    await this.enforceAttemptLimit(tempToken);

    const candidates = await this.backupCodeRepo.find({ where: { employeeId, used: false } });
    for (const candidate of candidates) {
      if (await bcrypt.compare(backupCode, candidate.codeHash)) {
        candidate.used = true;
        candidate.usedAt = new Date();
        await this.backupCodeRepo.save(candidate);
        await this.consumeTempToken(tempToken);
        this.securityLogger.log('mfa_verify_success', { employeeId, method: 'backup_code' });
        return this.authClient.issueTokenForEmployee(employeeId);
      }
    }

    await this.recordFailedAttempt(tempToken);
    this.securityLogger.warn('mfa_verify_failure', { employeeId, method: 'backup_code' });
    throw new UnauthorizedException('Invalid or already-used backup code');
  }

  private async resolveEmployeeIdFromTempToken(tempToken: string): Promise<number> {
    const raw = await this.redis.get(`${TEMP_TOKEN_PREFIX}${tempToken}`);
    if (!raw) {
      throw new UnauthorizedException('Invalid or expired tempToken');
    }
    return Number(raw);
  }

  private async enforceAttemptLimit(tempToken: string): Promise<void> {
    const maxAttempts = this.config.get<number>('MFA_MAX_VERIFY_ATTEMPTS') as number;
    const attempts = Number((await this.redis.get(`${ATTEMPT_PREFIX}${tempToken}`)) ?? 0);
    if (attempts >= maxAttempts) {
      await this.redis.del(`${TEMP_TOKEN_PREFIX}${tempToken}`, `${ATTEMPT_PREFIX}${tempToken}`);
      throw new HttpException(
        'Too many failed attempts — please log in again',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailedAttempt(tempToken: string): Promise<void> {
    const ttl = this.config.get<number>('MFA_TEMP_TOKEN_TTL_SECONDS') as number;
    const key = `${ATTEMPT_PREFIX}${tempToken}`;
    await this.redis.incr(key);
    await this.redis.expire(key, ttl);
  }

  private async consumeTempToken(tempToken: string): Promise<void> {
    await this.redis.del(`${TEMP_TOKEN_PREFIX}${tempToken}`, `${ATTEMPT_PREFIX}${tempToken}`);
  }
}
