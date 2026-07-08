import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

// Real HTTP pipeline test: JwtAuthGuard + RolesGuard + ValidationPipe are NOT mocked here.
// Only AuthService is mocked — this proves the guards themselves gate the routes, not
// just that the service happens to check roles internally.

const TEST_JWT_SECRET = 'test-secret-at-least-32-characters-long-for-hs256';

describe('AuthController (e2e, guards)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const authService = {
    findAllEmployees: jest.fn(),
    findEmployeeById: jest.fn(),
    updateEmployee: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret: TEST_JWT_SECRET, signOptions: { expiresIn: '24h' } }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        RolesGuard,
        JwtStrategy,
        {
          provide: ConfigService,
          // Real JwtStrategy, wired to a fake ConfigService returning the test secret —
          // this exercises the actual production JwtStrategy/PassportStrategy code path.
          useValue: {
            get: (key: string) => (key === 'JWT_ACCESS_SECRET' ? TEST_JWT_SECRET : undefined),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    jwt = new JwtService({ secret: TEST_JWT_SECRET });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function tokenFor(roleName: string, sub = 1): string {
    return jwt.sign({ sub, username: 'u', roleId: roleName === 'Admin' ? 1 : 2, roleName });
  }

  describe('GET /auth/employees', () => {
    it('rejects with 401 when no Authorization header is present', async () => {
      await request(app.getHttpServer()).get('/auth/employees').expect(401);
    });

    it('rejects with 401 for a malformed/garbage token', async () => {
      await request(app.getHttpServer())
        .get('/auth/employees')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(401);
    });

    it('rejects with 403 for a valid token whose role is Staff, not Admin', async () => {
      authService.findAllEmployees.mockResolvedValue([]);
      await request(app.getHttpServer())
        .get('/auth/employees')
        .set('Authorization', `Bearer ${tokenFor('Staff')}`)
        .expect(403);
      expect(authService.findAllEmployees).not.toHaveBeenCalled();
    });

    it('allows a valid Admin token through to the service', async () => {
      authService.findAllEmployees.mockResolvedValue([{ employeeId: 1 }]);
      const res = await request(app.getHttpServer())
        .get('/auth/employees')
        .set('Authorization', `Bearer ${tokenFor('Admin')}`)
        .expect(200);
      expect(res.body).toEqual([{ employeeId: 1 }]);
      expect(authService.findAllEmployees).toHaveBeenCalledWith({});
    });

    it('rejects an unknown query param when forbidNonWhitelisted is on', async () => {
      await request(app.getHttpServer())
        .get('/auth/employees?bogusParam=1')
        .set('Authorization', `Bearer ${tokenFor('Admin')}`)
        .expect(400);
    });
  });

  describe('GET /auth/employees/:id', () => {
    it('rejects with 401 with no token', async () => {
      await request(app.getHttpServer()).get('/auth/employees/1').expect(401);
    });

    it('returns 404 when the service throws NotFoundException', async () => {
      authService.findEmployeeById.mockRejectedValue(new NotFoundException('Employee not found'));
      await request(app.getHttpServer())
        .get('/auth/employees/999')
        .set('Authorization', `Bearer ${tokenFor('Admin')}`)
        .expect(404);
    });

    it('rejects a non-numeric id with 400 (ParseIntPipe)', async () => {
      await request(app.getHttpServer())
        .get('/auth/employees/not-a-number')
        .set('Authorization', `Bearer ${tokenFor('Admin')}`)
        .expect(400);
    });
  });

  describe('PATCH /auth/employees/:id', () => {
    it('rejects with 401 with no token', async () => {
      await request(app.getHttpServer())
        .patch('/auth/employees/2')
        .send({ isActive: false })
        .expect(401);
    });

    it('rejects with 403 for a Staff-role token (RolesGuard, admin-only route)', async () => {
      await request(app.getHttpServer())
        .patch('/auth/employees/2')
        .set('Authorization', `Bearer ${tokenFor('Staff')}`)
        .send({ isActive: false })
        .expect(403);
      expect(authService.updateEmployee).not.toHaveBeenCalled();
    });

    it('propagates 403 from the self-lockout guard when an admin targets their own id', async () => {
      authService.updateEmployee.mockRejectedValue(
        new ForbiddenException('Admins cannot modify their own employee record'),
      );
      await request(app.getHttpServer())
        .patch('/auth/employees/1')
        .set('Authorization', `Bearer ${tokenFor('Admin', 1)}`)
        .send({ isActive: false })
        .expect(403);
      expect(authService.updateEmployee).toHaveBeenCalledWith(1, { isActive: false }, 1);
    });

    it('rejects a body with an unexpected extra field (whitelist)', async () => {
      await request(app.getHttpServer())
        .patch('/auth/employees/2')
        .set('Authorization', `Bearer ${tokenFor('Admin', 1)}`)
        .send({ isActive: false, passwordHash: 'hacked' })
        .expect(400);
      expect(authService.updateEmployee).not.toHaveBeenCalled();
    });

    it('rejects roleId sent as a non-integer string', async () => {
      await request(app.getHttpServer())
        .patch('/auth/employees/2')
        .set('Authorization', `Bearer ${tokenFor('Admin', 1)}`)
        .send({ roleId: 'not-an-int' })
        .expect(400);
    });

    it('allows a valid Admin token targeting a different employee through to the service', async () => {
      authService.updateEmployee.mockResolvedValue({ employeeId: 2, isActive: false });
      const res = await request(app.getHttpServer())
        .patch('/auth/employees/2')
        .set('Authorization', `Bearer ${tokenFor('Admin', 1)}`)
        .send({ isActive: false })
        .expect(200);
      expect(res.body).toEqual({ employeeId: 2, isActive: false });
    });
  });
});
