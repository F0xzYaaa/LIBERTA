import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { REDIS_CLIENT } from './redis/redis.provider';
import { Employee } from './entities/employee.entity';
import { Role } from './entities/role.entity';
import { EmployeeSummaryResponseDto } from './dto/employee-summary-response.dto';
import { FindAllEmployeesDto } from './dto/find-all-employees.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RegisterEmployeeDto } from './dto/register-employee.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const TEMP_TOKEN_PREFIX = 'temp_token:';
const REFRESH_JTI_PREFIX = 'refresh_jti:';
const LOGIN_ATTEMPT_PREFIX = 'login_attempts:';
const BCRYPT_COST = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly securityLogger: SecurityLogger,
  ) {}

  async login(dto: LoginDto, ip?: string): Promise<LoginResponseDto> {
    await this.enforceLoginAttemptLimit(dto.username);

    const employee = await this.employeeRepo.findOne({ where: { username: dto.username } });

    // Constant-shape response: run bcrypt.compare even when the account is missing,
    // against a fixed dummy hash, so login timing doesn't reveal whether the username exists.
    const hashToCompare =
      employee?.passwordHash ?? '$2b$10$invalidsaltinvalidsaltinvalidsaltuseonly000000000000';
    const passwordMatches = await bcrypt.compare(dto.password, hashToCompare);

    if (!employee || !passwordMatches) {
      await this.recordFailedLoginAttempt(dto.username);
      this.securityLogger.warn('login_failure', {
        username: dto.username,
        ip,
        reason: 'bad_credentials',
      });
      throw new UnauthorizedException('Invalid username or password');
    }

    // Correct credentials presented — reset the counter regardless of active state below,
    // since the failed-attempt counter exists to stop password guessing, not to punish a
    // legitimate credential holder whose account happens to be deactivated.
    await this.resetLoginAttempts(dto.username);

    if (!employee.isActive) {
      this.securityLogger.warn('login_failure', {
        username: dto.username,
        ip,
        reason: 'account_deactivated',
      });
      throw new ForbiddenException('Employee account is deactivated');
    }

    const tempToken = randomUUID();
    const ttl = this.config.get<number>('MFA_TEMP_TOKEN_TTL_SECONDS') as number;
    await this.redis.set(`${TEMP_TOKEN_PREFIX}${tempToken}`, employee.employeeId, 'EX', ttl);

    this.securityLogger.log('login_password_verified', {
      employeeId: employee.employeeId,
      username: employee.username,
      ip,
    });

    return {
      tempToken,
      mfaRequired: employee.mfaEnabled,
      mfaEnrollmentRequired: !employee.mfaEnabled,
    };
  }

  async registerEmployee(
    dto: RegisterEmployeeDto,
    actingEmployeeId: number,
  ): Promise<Pick<Employee, 'employeeId' | 'username' | 'fullName' | 'email'>> {
    const role = await this.roleRepo.findOne({ where: { roleId: dto.roleId } });
    if (!role) {
      throw new ConflictException('roleId does not reference an existing Role');
    }

    const existing = await this.employeeRepo.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (existing) {
      throw new ConflictException('Username or email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const employee = this.employeeRepo.create({
      roleId: dto.roleId,
      username: dto.username,
      passwordHash,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone ?? null,
    });
    const saved = await this.employeeRepo.save(employee);

    this.securityLogger.log('admin_action_register_employee', {
      actingEmployeeId,
      newEmployeeId: saved.employeeId,
      newUsername: saved.username,
      roleId: dto.roleId,
    });

    return {
      employeeId: saved.employeeId,
      username: saved.username,
      fullName: saved.fullName,
      email: saved.email,
    };
  }

  async findAllEmployees(filters: FindAllEmployeesDto): Promise<EmployeeSummaryResponseDto[]> {
    const qb = this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.role', 'role');

    if (filters.roleId !== undefined) {
      qb.andWhere('employee.roleId = :roleId', { roleId: filters.roleId });
    }
    if (filters.isActive !== undefined) {
      qb.andWhere('employee.isActive = :isActive', { isActive: filters.isActive === 'true' });
    }

    const employees = await qb.getMany();
    return employees.map((employee) => this.toEmployeeSummary(employee));
  }

  async findEmployeeById(employeeId: number): Promise<EmployeeSummaryResponseDto> {
    const employee = await this.employeeRepo.findOne({
      where: { employeeId },
      relations: ['role'],
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return this.toEmployeeSummary(employee);
  }

  async updateEmployee(
    employeeId: number,
    dto: UpdateEmployeeDto,
    actingEmployeeId: number,
  ): Promise<EmployeeSummaryResponseDto> {
    // Self-lockout guard: an admin can never deactivate or demote their own account.
    if (employeeId === actingEmployeeId) {
      throw new ForbiddenException('Admins cannot modify their own employee record');
    }

    const employee = await this.employeeRepo.findOne({
      where: { employeeId },
      relations: ['role'],
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (dto.roleId !== undefined) {
      const role = await this.roleRepo.findOne({ where: { roleId: dto.roleId } });
      if (!role) {
        throw new BadRequestException('roleId does not reference an existing Role');
      }
      employee.roleId = dto.roleId;
      employee.role = role;
    }
    if (dto.isActive !== undefined) {
      employee.isActive = dto.isActive;
    }

    const saved = await this.employeeRepo.save(employee);

    this.securityLogger.log('admin_action_update_employee', {
      actingEmployeeId,
      targetEmployeeId: employeeId,
      isActive: dto.isActive,
      roleId: dto.roleId,
    });

    return this.toEmployeeSummary(saved);
  }

  private toEmployeeSummary(employee: Employee): EmployeeSummaryResponseDto {
    return {
      employeeId: employee.employeeId,
      username: employee.username,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      roleId: employee.roleId,
      roleName: employee.role?.roleName,
      mfaEnabled: employee.mfaEnabled,
      isActive: employee.isActive,
      lastLoginAt: employee.lastLoginAt,
      createdAt: employee.createdAt,
    };
  }

  async logout(employeeId: number): Promise<void> {
    await this.redis.del(`${REFRESH_JTI_PREFIX}${employeeId}`);
    this.securityLogger.log('logout', { employeeId });
  }

  /** Called only by mfa-service (internal, key-guarded) after TOTP verification succeeds. */
  async issueTokenForEmployee(employeeId: number): Promise<TokenResponseDto> {
    const employee = await this.employeeRepo.findOne({
      where: { employeeId },
      relations: ['role'],
    });
    if (!employee) {
      throw new UnauthorizedException('Employee not found');
    }

    employee.lastLoginAt = new Date();
    await this.employeeRepo.save(employee);

    this.securityLogger.log('login_success', {
      employeeId: employee.employeeId,
      username: employee.username,
    });

    return this.issueTokenPair(employee);
  }

  async refresh(refreshToken: string): Promise<TokenResponseDto> {
    let payload: { sub: number; jti: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      this.securityLogger.warn('refresh_failure', { reason: 'invalid_or_expired_token' });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const storedJti = await this.redis.get(`${REFRESH_JTI_PREFIX}${payload.sub}`);
    if (!storedJti || storedJti !== payload.jti) {
      this.securityLogger.warn('refresh_failure', {
        employeeId: payload.sub,
        reason: 'rotated_or_revoked',
      });
      throw new UnauthorizedException('Refresh token has been rotated or revoked');
    }

    const employee = await this.employeeRepo.findOne({
      where: { employeeId: payload.sub },
      relations: ['role'],
    });
    if (!employee || !employee.isActive) {
      throw new UnauthorizedException('Employee not found or inactive');
    }

    return this.issueTokenPair(employee);
  }

  private async issueTokenPair(employee: Employee): Promise<TokenResponseDto> {
    const accessExpires = this.config.get<string>('JWT_ACCESS_EXPIRES') as string;
    const refreshExpires = this.config.get<string>('JWT_REFRESH_EXPIRES') as string;
    const refreshTtlSeconds = this.config.get<number>('JWT_REFRESH_TTL_SECONDS') as number;

    const basePayload = {
      sub: employee.employeeId,
      username: employee.username,
      roleId: employee.roleId,
      roleName: employee.role?.roleName,
    };

    const accessToken = this.jwt.sign(basePayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpires,
    });

    const jti = randomUUID();
    const refreshToken = this.jwt.sign(
      { sub: employee.employeeId, jti },
      { secret: this.config.get<string>('JWT_REFRESH_SECRET'), expiresIn: refreshExpires },
    );
    await this.redis.set(
      `${REFRESH_JTI_PREFIX}${employee.employeeId}`,
      jti,
      'EX',
      refreshTtlSeconds,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresInSeconds(accessExpires),
    };
  }

  /**
   * Employee.username is looked up under a case-insensitive, pad-space MySQL
   * collation (utf8mb4_unicode_ci — see database/schema.sql), so "admin",
   * "ADMIN", and "admin  " all resolve to the same account. The Redis lockout
   * key must be normalized to match, otherwise an attacker can multiply their
   * guess budget past LOGIN_MAX_ATTEMPTS by varying case/whitespace while
   * authenticating against the same underlying account.
   */
  private normalizeLoginKey(username: string): string {
    return `${LOGIN_ATTEMPT_PREFIX}${username.trim().toLowerCase()}`;
  }

  /** Per-username brute-force guard on POST /auth/login, mirroring mfa-service's attempt counter. */
  private async enforceLoginAttemptLimit(username: string): Promise<void> {
    const maxAttempts = this.config.get<number>('LOGIN_MAX_ATTEMPTS') as number;
    const attempts = Number((await this.redis.get(this.normalizeLoginKey(username))) ?? 0);
    if (attempts >= maxAttempts) {
      // Generic message — never reveals remaining attempts or whether the username exists.
      throw new HttpException(
        'Too many failed login attempts — please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async recordFailedLoginAttempt(username: string): Promise<void> {
    const windowSeconds = this.config.get<number>('LOGIN_LOCKOUT_WINDOW_SECONDS') as number;
    const key = this.normalizeLoginKey(username);
    await this.redis.incr(key);
    await this.redis.expire(key, windowSeconds);
  }

  private async resetLoginAttempts(username: string): Promise<void> {
    await this.redis.del(this.normalizeLoginKey(username));
  }

  private parseExpiresInSeconds(expires: string): number {
    const match = /^(\d+)([smhd])$/.exec(expires);
    if (!match) return 0;
    const value = Number(match[1]);
    const unit = match[2];
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1;
    return value * multiplier;
  }
}
