import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { SecurityLogger } from '../common/security-logger.service';
import { AuthService } from './auth.service';
import { Employee } from './entities/employee.entity';
import { Role } from './entities/role.entity';
import { REDIS_CLIENT } from './redis/redis.provider';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let employeeRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let roleRepo: { findOne: jest.Mock; find: jest.Mock };
  let redis: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    incr: jest.Mock;
    expire: jest.Mock;
  };
  let jwt: { sign: jest.Mock; verify: jest.Mock };
  let config: { get: jest.Mock };

  const activeEmployee: Employee = {
    employeeId: 1,
    roleId: 2,
    role: { roleId: 2, roleName: 'Staff', description: null, createdAt: new Date() },
    username: 'staff01',
    passwordHash: '$hashed$',
    fullName: 'Staff One',
    email: 'staff01@libertahuahin.com',
    phone: null,
    mfaEnabled: true,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    employeeRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    roleRepo = { findOne: jest.fn(), find: jest.fn() };
    redis = { set: jest.fn(), get: jest.fn(), del: jest.fn(), incr: jest.fn(), expire: jest.fn() };
    jwt = { sign: jest.fn(), verify: jest.fn() };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number> = {
          MFA_TEMP_TOKEN_TTL_SECONDS: 300,
          JWT_ACCESS_EXPIRES: '24h',
          JWT_REFRESH_EXPIRES: '24h',
          JWT_REFRESH_TTL_SECONDS: 86400,
          JWT_ACCESS_SECRET: 'access-secret-at-least-32-characters-long',
          JWT_REFRESH_SECRET: 'refresh-secret-at-least-32-characters-long',
          LOGIN_MAX_ATTEMPTS: 5,
          LOGIN_LOCKOUT_WINDOW_SECONDS: 900,
        };
        return values[key];
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Employee), useValue: employeeRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        SecurityLogger,
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('returns a tempToken and mfaRequired=true for a valid, active, MFA-enrolled employee', async () => {
      employeeRepo.findOne.mockResolvedValue(activeEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      redis.set.mockResolvedValue('OK');

      const result = await service.login({ username: 'staff01', password: 'password123' });

      expect(result.mfaRequired).toBe(true);
      expect(result.mfaEnrollmentRequired).toBe(false);
      expect(result.tempToken).toEqual(expect.any(String));
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('temp_token:'),
        activeEmployee.employeeId,
        'EX',
        300,
      );
    });

    it('rejects a wrong password with a generic 401 message', async () => {
      employeeRepo.findOne.mockResolvedValue(activeEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ username: 'staff01', password: 'wrong-pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an unknown username with the same generic message as a wrong password', async () => {
      employeeRepo.findOne.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ username: 'nobody', password: 'password123' })).rejects.toThrow(
        UnauthorizedException,
      );
      // Ensures the anti-enumeration compare-against-dummy-hash path actually executes.
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', expect.any(String));
    });

    it('rejects a deactivated employee with 403, even with the correct password', async () => {
      employeeRepo.findOne.mockResolvedValue({ ...activeEmployee, isActive: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ username: 'staff01', password: 'password123' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('flags mfaEnrollmentRequired when the employee has not enrolled in MFA yet', async () => {
      employeeRepo.findOne.mockResolvedValue({ ...activeEmployee, mfaEnabled: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      redis.set.mockResolvedValue('OK');

      const result = await service.login({ username: 'staff01', password: 'password123' });

      expect(result.mfaRequired).toBe(false);
      expect(result.mfaEnrollmentRequired).toBe(true);
    });
  });

  describe('login — per-account lockout (brute-force guard)', () => {
    it('records a failed attempt on each bad password, keyed by username', async () => {
      redis.get.mockResolvedValue(undefined);
      employeeRepo.findOne.mockResolvedValue(activeEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ username: 'staff01', password: 'wrong-pass' })).rejects.toThrow(
        UnauthorizedException,
      );

      expect(redis.incr).toHaveBeenCalledWith('login_attempts:staff01');
      expect(redis.expire).toHaveBeenCalledWith('login_attempts:staff01', 900);
    });

    it('locks out on the 5th failed attempt with a 429, without revealing remaining attempts', async () => {
      redis.get.mockResolvedValue('5');
      employeeRepo.findOne.mockResolvedValue(activeEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'staff01', password: 'wrong-pass' }),
      ).rejects.toMatchObject({
        status: 429,
        message: 'Too many failed login attempts — please try again later',
      });

      // The lockout is enforced before any DB lookup or password check runs.
      expect(employeeRepo.findOne).not.toHaveBeenCalled();
      expect(redis.incr).not.toHaveBeenCalled();
    });

    it('returns the same lockout error even when the correct credentials are presented', async () => {
      redis.get.mockResolvedValue('5');
      employeeRepo.findOne.mockResolvedValue(activeEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ username: 'staff01', password: 'password123' })).rejects.toThrow(
        HttpException,
      );
      expect(employeeRepo.findOne).not.toHaveBeenCalled();
    });

    it('allows retry once the lockout window (TTL) has expired, i.e. the counter key is gone', async () => {
      redis.get.mockResolvedValue(null);
      employeeRepo.findOne.mockResolvedValue(activeEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      redis.set.mockResolvedValue('OK');

      const result = await service.login({ username: 'staff01', password: 'password123' });

      expect(result.tempToken).toEqual(expect.any(String));
    });

    it('resets the failed-attempt counter on a successful login', async () => {
      redis.get.mockResolvedValue('3');
      employeeRepo.findOne.mockResolvedValue(activeEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      redis.set.mockResolvedValue('OK');

      await service.login({ username: 'staff01', password: 'password123' });

      expect(redis.del).toHaveBeenCalledWith('login_attempts:staff01');
    });

    it('keys the lockout counter on a normalized username, so case/whitespace variants share one bucket', async () => {
      // Employee.username is looked up under a case-insensitive, pad-space MySQL
      // collation (utf8mb4_unicode_ci) — "STAFF01" and "staff01  " both resolve to
      // the same account. Regression test for a real bypass found by the Stage 6
      // security-auditor pass: without normalization, each variant got its own
      // Redis key, letting an attacker multiply their guess budget past
      // LOGIN_MAX_ATTEMPTS by cycling case/whitespace against one real account.
      redis.get.mockResolvedValue(undefined);
      employeeRepo.findOne.mockResolvedValue(activeEmployee);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ username: 'STAFF01', password: 'wrong-pass' })).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(
        service.login({ username: '  staff01  ', password: 'wrong-pass' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(redis.incr).toHaveBeenCalledWith('login_attempts:staff01');
      expect(redis.incr).not.toHaveBeenCalledWith('login_attempts:STAFF01');
      expect(redis.incr).not.toHaveBeenCalledWith('login_attempts:  staff01  ');
      expect(redis.incr).toHaveBeenCalledTimes(2);
    });
  });

  describe('registerEmployee', () => {
    const dto = {
      roleId: 1,
      username: 'newstaff',
      password: 'a-strong-password',
      fullName: 'New Staff',
      email: 'newstaff@libertahuahin.com',
    };

    it('creates a new employee with a bcrypt-hashed password and never returns the hash', async () => {
      roleRepo.findOne.mockResolvedValue({ roleId: 1, roleName: 'Staff' });
      employeeRepo.findOne.mockResolvedValue(null);
      employeeRepo.create.mockImplementation((entity) => entity);
      employeeRepo.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity, employeeId: 5, passwordHash: 'hashed' }),
      );

      const result = await service.registerEmployee(dto, 1);

      expect(result).toEqual({
        employeeId: 5,
        username: 'newstaff',
        fullName: 'New Staff',
        email: 'newstaff@libertahuahin.com',
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects registration with a duplicate username or email as 409 Conflict', async () => {
      roleRepo.findOne.mockResolvedValue({ roleId: 1, roleName: 'Staff' });
      employeeRepo.findOne.mockResolvedValue(activeEmployee);

      await expect(service.registerEmployee(dto, 1)).rejects.toThrow(ConflictException);
    });

    it('rejects registration when roleId does not reference an existing Role', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(service.registerEmployee(dto, 1)).rejects.toThrow(ConflictException);
    });
  });

  describe('refresh', () => {
    it('rejects an expired or tampered refresh token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh('tampered-or-expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token whose jti no longer matches the stored (rotated) one', async () => {
      jwt.verify.mockReturnValue({ sub: 1, jti: 'old-jti' });
      redis.get.mockResolvedValue('new-jti-after-rotation');

      await expect(service.refresh('stale-refresh-token')).rejects.toThrow(UnauthorizedException);
    });

    it('issues a new token pair when the refresh token is valid and not yet rotated', async () => {
      jwt.verify.mockReturnValue({ sub: 1, jti: 'current-jti' });
      redis.get.mockResolvedValue('current-jti');
      employeeRepo.findOne.mockResolvedValue(activeEmployee);
      jwt.sign.mockReturnValue('signed-token');
      redis.set.mockResolvedValue('OK');

      const result = await service.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
    });
  });

  describe('logout', () => {
    it('deletes the stored refresh jti for the employee', async () => {
      redis.del.mockResolvedValue(1);

      await service.logout(1);

      expect(redis.del).toHaveBeenCalledWith('refresh_jti:1');
    });
  });

  describe('issueTokenForEmployee', () => {
    it('throws Unauthorized if the employee does not exist (defensive check)', async () => {
      employeeRepo.findOne.mockResolvedValue(null);

      await expect(service.issueTokenForEmployee(999)).rejects.toThrow(UnauthorizedException);
    });

    it('issues a token pair and updates lastLoginAt for a valid employee', async () => {
      employeeRepo.findOne.mockResolvedValue({ ...activeEmployee });
      employeeRepo.save.mockResolvedValue(activeEmployee);
      jwt.sign.mockReturnValue('signed-token');
      redis.set.mockResolvedValue('OK');

      const result = await service.issueTokenForEmployee(1);

      expect(result.accessToken).toBe('signed-token');
      expect(employeeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      );
    });
  });

  describe('findAllEmployees', () => {
    function makeQueryBuilder(rows: Employee[]) {
      return {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
    }

    it('lists all employees with no filters, never exposing passwordHash', async () => {
      const qb = makeQueryBuilder([activeEmployee]);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllEmployees({});

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(result[0].roleName).toBe('Staff');
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('applies roleId and isActive filters when provided', async () => {
      const qb = makeQueryBuilder([activeEmployee]);
      employeeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAllEmployees({ roleId: 2, isActive: 'true' });

      expect(qb.andWhere).toHaveBeenCalledWith('employee.roleId = :roleId', { roleId: 2 });
      expect(qb.andWhere).toHaveBeenCalledWith('employee.isActive = :isActive', {
        isActive: true,
      });
    });
  });

  describe('findEmployeeById', () => {
    it('returns an employee summary when found', async () => {
      employeeRepo.findOne.mockResolvedValue(activeEmployee);

      const result = await service.findEmployeeById(1);

      expect(result.employeeId).toBe(1);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      employeeRepo.findOne.mockResolvedValue(null);

      await expect(service.findEmployeeById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllRoles', () => {
    it('returns roles ordered by id without timestamps', async () => {
      roleRepo.find.mockResolvedValue([
        { roleId: 1, roleName: 'Staff', description: 'Front desk', createdAt: new Date() },
        { roleId: 2, roleName: 'Admin', description: null, createdAt: new Date() },
      ]);

      const roles = await service.findAllRoles();

      expect(roleRepo.find).toHaveBeenCalledWith({ order: { roleId: 'ASC' } });
      expect(roles).toEqual([
        { roleId: 1, roleName: 'Staff', description: 'Front desk' },
        { roleId: 2, roleName: 'Admin', description: null },
      ]);
    });
  });

  describe('deleteEmployee', () => {
    it('deletes the employee and revokes their refresh token', async () => {
      employeeRepo.findOne.mockResolvedValue({ ...activeEmployee });
      employeeRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteEmployee(1, 2);

      expect(employeeRepo.delete).toHaveBeenCalledWith({ employeeId: 1 });
      expect(redis.del).toHaveBeenCalledWith('refresh_jti:1');
    });

    it('refuses to let an admin delete themselves', async () => {
      await expect(service.deleteEmployee(2, 2)).rejects.toThrow(ForbiddenException);
      expect(employeeRepo.delete).not.toHaveBeenCalled();
    });

    it('returns 409 when the employee appears in booking history', async () => {
      employeeRepo.findOne.mockResolvedValue({ ...activeEmployee });
      employeeRepo.delete.mockRejectedValue(Object.assign(new Error('FK'), { errno: 1451 }));

      await expect(service.deleteEmployee(1, 2)).rejects.toThrow(ConflictException);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown employee', async () => {
      employeeRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteEmployee(999, 2)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateEmployee', () => {
    it('updates full name, email and phone (trimmed; empty phone clears it)', async () => {
      employeeRepo.findOne
        .mockResolvedValueOnce({ ...activeEmployee, phone: '081-111-2222' })
        .mockResolvedValueOnce(null); // no other owner of the new email
      employeeRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateEmployee(
        1,
        { fullName: '  Staff Renamed ', email: ' new@liberta.test ', phone: '' },
        2,
      );

      expect(result.fullName).toBe('Staff Renamed');
      expect(result.email).toBe('new@liberta.test');
      expect(result.phone).toBeNull();
    });

    it('returns 409 when the new email belongs to another employee', async () => {
      employeeRepo.findOne
        .mockResolvedValueOnce({ ...activeEmployee })
        .mockResolvedValueOnce({ ...activeEmployee, employeeId: 3 });

      await expect(service.updateEmployee(1, { email: 'taken@liberta.test' }, 2)).rejects.toThrow(
        ConflictException,
      );
      expect(employeeRepo.save).not.toHaveBeenCalled();
    });

    it('allows saving an unchanged email that the employee already owns', async () => {
      employeeRepo.findOne
        .mockResolvedValueOnce({ ...activeEmployee })
        .mockResolvedValueOnce({ ...activeEmployee });
      employeeRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateEmployee(1, { email: activeEmployee.email }, 2);

      expect(result.email).toBe(activeEmployee.email);
    });

    it('maps a duplicate-key race on save to 409', async () => {
      employeeRepo.findOne.mockResolvedValueOnce({ ...activeEmployee }).mockResolvedValueOnce(null);
      employeeRepo.save.mockRejectedValue(Object.assign(new Error('dup'), { errno: 1062 }));

      await expect(service.updateEmployee(1, { email: 'race@liberta.test' }, 2)).rejects.toThrow(
        ConflictException,
      );
    });

    it('updates isActive and returns the new summary', async () => {
      employeeRepo.findOne.mockResolvedValue({ ...activeEmployee });
      employeeRepo.save.mockImplementation((entity) => Promise.resolve(entity));

      const result = await service.updateEmployee(1, { isActive: false }, 2);

      expect(result.isActive).toBe(false);
      expect(employeeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });

    it('throws NotFoundException when the target employee does not exist', async () => {
      employeeRepo.findOne.mockResolvedValue(null);

      await expect(service.updateEmployee(999, { isActive: false }, 2)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when roleId does not reference an existing Role', async () => {
      employeeRepo.findOne.mockResolvedValue({ ...activeEmployee });
      roleRepo.findOne.mockResolvedValue(null);

      await expect(service.updateEmployee(1, { roleId: 999 }, 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when an admin attempts to modify their own record (self-lockout guard)', async () => {
      await expect(service.updateEmployee(2, { isActive: false }, 2)).rejects.toThrow(
        ForbiddenException,
      );
      expect(employeeRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
