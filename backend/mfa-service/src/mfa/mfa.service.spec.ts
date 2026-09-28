import { ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { SecurityLogger } from '../common/security-logger.service';
import { AuthClientService } from './auth-client.service';
import { BackupCode } from './entities/backup-code.entity';
import { Employee } from './entities/employee.entity';
import { MFASecret } from './entities/mfa-secret.entity';
import { MfaService } from './mfa.service';
import { REDIS_CLIENT } from './redis/redis.provider';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-code'),
}));

describe('MfaService', () => {
  let service: MfaService;
  let employeeRepo: { findOne: jest.Mock; update: jest.Mock; save: jest.Mock };
  let mfaSecretRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock };
  let backupCodeRepo: {
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock; incr: jest.Mock; expire: jest.Mock };
  let authClient: { issueTokenForEmployee: jest.Mock };
  let config: { get: jest.Mock };

  const employee: Employee = {
    employeeId: 1,
    username: 'staff01',
    mfaEnabled: false,
    isActive: true,
  };

  beforeEach(async () => {
    employeeRepo = { findOne: jest.fn(), update: jest.fn(), save: jest.fn() };
    mfaSecretRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), delete: jest.fn() };
    backupCodeRepo = { find: jest.fn(), save: jest.fn(), create: jest.fn(), delete: jest.fn() };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn(), incr: jest.fn(), expire: jest.fn() };
    authClient = { issueTokenForEmployee: jest.fn() };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number> = {
          TOTP_ISSUER: 'LIBERTA หัวหิน',
          MFA_MAX_VERIFY_ATTEMPTS: 5,
          MFA_TEMP_TOKEN_TTL_SECONDS: 300,
        };
        return values[key];
      }),
    };

    mfaSecretRepo.create.mockImplementation((entity) => entity);
    backupCodeRepo.create.mockImplementation((entity) => entity);

    const moduleRef = await Test.createTestingModule({
      providers: [
        MfaService,
        { provide: getRepositoryToken(Employee), useValue: employeeRepo },
        { provide: getRepositoryToken(MFASecret), useValue: mfaSecretRepo },
        { provide: getRepositoryToken(BackupCode), useValue: backupCodeRepo },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: AuthClientService, useValue: authClient },
        { provide: ConfigService, useValue: config },
        SecurityLogger,
      ],
    }).compile();

    service = moduleRef.get(MfaService);
  });

  describe('generate (self-enrollment)', () => {
    it('rejects an invalid or expired tempToken', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.generate('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects re-enrollment if the employee already has an activated MFA secret', async () => {
      redis.get.mockResolvedValue('1');
      mfaSecretRepo.findOne.mockResolvedValue({
        mfaId: 1,
        employeeId: 1,
        secret: 'EXISTINGSECRET',
        activatedAt: new Date(),
      });

      await expect(service.generate('valid-temp-token')).rejects.toThrow(ConflictException);
    });

    it('generates a secret, QR code, and 10 backup codes for a fresh enrollment', async () => {
      redis.get.mockResolvedValue('1');
      mfaSecretRepo.findOne.mockResolvedValue(null);
      employeeRepo.findOne.mockResolvedValue(employee);
      mfaSecretRepo.save.mockResolvedValue({});
      backupCodeRepo.save.mockResolvedValue([]);

      const result = await service.generate('valid-temp-token');

      expect(result.qrCodeDataUri).toMatch(/^data:image\/png;base64,/);
      expect(result.manualEntryKey).toEqual(expect.any(String));
      expect(result.backupCodes).toHaveLength(10);
      expect(new Set(result.backupCodes).size).toBe(10);
    });
  });

  describe('verifyTotp', () => {
    it('rejects an invalid or expired tempToken', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.verifyTotp('bad-token', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects when the max failed-attempt count has been reached (429)', async () => {
      redis.get.mockImplementation((key: string) =>
        key.startsWith('mfa_attempts:') ? Promise.resolve('5') : Promise.resolve('1'),
      );

      await expect(service.verifyTotp('temp-token', '123456')).rejects.toThrow(HttpException);
    });

    it('rejects an invalid TOTP code and records a failed attempt', async () => {
      redis.get.mockImplementation((key: string) =>
        key.startsWith('mfa_attempts:') ? Promise.resolve('0') : Promise.resolve('1'),
      );
      mfaSecretRepo.findOne.mockResolvedValue({
        mfaId: 1,
        employeeId: 1,
        secret: 'EXISTINGSECRET',
        activatedAt: new Date(),
      });
      jest.spyOn(authenticator, 'verify').mockReturnValue(false);

      await expect(service.verifyTotp('temp-token', '000000')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(redis.incr).toHaveBeenCalledWith('mfa_attempts:temp-token');
    });

    it('accepts a valid TOTP code, consumes the tempToken exactly once, and issues a JWT', async () => {
      redis.get.mockImplementation((key: string) =>
        key.startsWith('mfa_attempts:') ? Promise.resolve('0') : Promise.resolve('1'),
      );
      mfaSecretRepo.findOne.mockResolvedValue({
        mfaId: 1,
        employeeId: 1,
        secret: 'EXISTINGSECRET',
        activatedAt: new Date(),
      });
      jest.spyOn(authenticator, 'verify').mockReturnValue(true);
      authClient.issueTokenForEmployee.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'b',
        expiresIn: 86400,
      });

      const result = await service.verifyTotp('temp-token', '123456');

      expect(result.accessToken).toBe('a');
      expect(redis.del).toHaveBeenCalledWith('temp_token:temp-token', 'mfa_attempts:temp-token');
      expect(authClient.issueTokenForEmployee).toHaveBeenCalledWith(1);
    });

    it('activates the MFA secret and flips Employee.mfaEnabled on first-ever successful verify', async () => {
      redis.get.mockImplementation((key: string) =>
        key.startsWith('mfa_attempts:') ? Promise.resolve('0') : Promise.resolve('1'),
      );
      mfaSecretRepo.findOne.mockResolvedValue({
        mfaId: 1,
        employeeId: 1,
        secret: 'EXISTINGSECRET',
        activatedAt: null,
      });
      jest.spyOn(authenticator, 'verify').mockReturnValue(true);
      authClient.issueTokenForEmployee.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'b',
        expiresIn: 86400,
      });

      await service.verifyTotp('temp-token', '123456');

      expect(mfaSecretRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ activatedAt: expect.any(Date) }),
      );
      expect(employeeRepo.update).toHaveBeenCalledWith({ employeeId: 1 }, { mfaEnabled: true });
    });
  });

  describe('verifyBackupCode', () => {
    it('accepts a valid unused backup code, marks it used, and issues a JWT', async () => {
      redis.get.mockImplementation((key: string) =>
        key.startsWith('mfa_attempts:') ? Promise.resolve('0') : Promise.resolve('1'),
      );
      backupCodeRepo.find.mockResolvedValue([
        { codeId: 1, employeeId: 1, codeHash: 'hashed-code', used: false },
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      authClient.issueTokenForEmployee.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'b',
        expiresIn: 86400,
      });

      const result = await service.verifyBackupCode('temp-token', 'AAAAA-BBBBB');

      expect(result.accessToken).toBe('a');
      expect(backupCodeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ used: true, usedAt: expect.any(Date) }),
      );
    });

    it('rejects an already-used or unknown backup code', async () => {
      redis.get.mockImplementation((key: string) =>
        key.startsWith('mfa_attempts:') ? Promise.resolve('0') : Promise.resolve('1'),
      );
      backupCodeRepo.find.mockResolvedValue([]);

      await expect(service.verifyBackupCode('temp-token', 'AAAAA-BBBBB')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
