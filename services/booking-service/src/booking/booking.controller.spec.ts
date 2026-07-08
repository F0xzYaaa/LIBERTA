import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { PassThrough } from 'stream';
import request from 'supertest';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingStatus } from './entities/booking.entity';

// Real HTTP pipeline test: JwtAuthGuard + RolesGuard + ValidationPipe + FileInterceptor are NOT
// mocked here. Only BookingService is mocked. This proves the two new payment endpoints are
// actually gated at the NestJS layer (never a static/Nginx path), per the architect's design.

const TEST_JWT_SECRET = 'test-secret-at-least-32-characters-long-for-hs256';

describe('BookingController (e2e, guards) - payment endpoints', () => {
  let app: INestApplication;
  const bookingService = {
    confirmPayment: jest.fn(),
    getSlipStream: jest.fn(),
    createDraft: jest.fn(),
    lookup: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [BookingController],
      providers: [
        { provide: BookingService, useValue: bookingService },
        RolesGuard,
        JwtStrategy,
        {
          provide: ConfigService,
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
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function tokenFor(roleName: string, sub = 1): string {
    return jwt.sign(
      { sub, username: 'u', roleId: roleName === 'Admin' ? 1 : 2, roleName },
      TEST_JWT_SECRET,
      { expiresIn: '24h' },
    );
  }

  describe('POST /bookings/:id/confirm-payment', () => {
    it('rejects with 401 when no Authorization header is present', async () => {
      await request(app.getHttpServer())
        .post('/bookings/1/confirm-payment')
        .field('paymentNote', 'PromptPay')
        .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'slip.jpg')
        .expect(401);
      expect(bookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it('rejects with 401 for a garbage token', async () => {
      await request(app.getHttpServer())
        .post('/bookings/1/confirm-payment')
        .set('Authorization', 'Bearer garbage')
        .field('paymentNote', 'PromptPay')
        .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'slip.jpg')
        .expect(401);
    });

    it('rejects with 403 for a valid token with no Admin/Staff role', async () => {
      await request(app.getHttpServer())
        .post('/bookings/1/confirm-payment')
        .set('Authorization', `Bearer ${tokenFor('Guest')}`)
        .field('paymentNote', 'PromptPay')
        .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'slip.jpg')
        .expect(403);
      expect(bookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it('accepts a Staff token (not just Admin)', async () => {
      bookingService.confirmPayment.mockResolvedValue({
        bookingId: 1,
        status: BookingStatus.Reserved,
        paymentConfirmedAt: new Date('2026-07-08T00:00:00Z'),
        paymentConfirmedBy: 7,
        hasSlip: true,
      });
      await request(app.getHttpServer())
        .post('/bookings/1/confirm-payment')
        .set('Authorization', `Bearer ${tokenFor('Staff', 7)}`)
        .field('paymentNote', 'PromptPay 08/07')
        .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'slip.jpg')
        .expect(201);
      expect(bookingService.confirmPayment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ buffer: expect.any(Buffer) }),
        expect.objectContaining({ paymentNote: 'PromptPay 08/07' }),
        7,
      );
    });

    it('returns 400 when no file is attached', async () => {
      await request(app.getHttpServer())
        .post('/bookings/1/confirm-payment')
        .set('Authorization', `Bearer ${tokenFor('Admin')}`)
        .field('paymentNote', 'PromptPay')
        .expect(400);
      expect(bookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it('returns 400 when paymentNote is missing (DTO validation)', async () => {
      await request(app.getHttpServer())
        .post('/bookings/1/confirm-payment')
        .set('Authorization', `Bearer ${tokenFor('Admin')}`)
        .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'slip.jpg')
        .expect(400);
      expect(bookingService.confirmPayment).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric booking id with 400 (ParseIntPipe)', async () => {
      await request(app.getHttpServer())
        .post('/bookings/abc/confirm-payment')
        .set('Authorization', `Bearer ${tokenFor('Admin')}`)
        .field('paymentNote', 'PromptPay')
        .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'slip.jpg')
        .expect(400);
    });

    it('propagates 404 when the service reports the booking does not exist', async () => {
      bookingService.confirmPayment.mockRejectedValue(new NotFoundException('Booking not found'));
      await request(app.getHttpServer())
        .post('/bookings/999/confirm-payment')
        .set('Authorization', `Bearer ${tokenFor('Admin')}`)
        .field('paymentNote', 'PromptPay')
        .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'slip.jpg')
        .expect(404);
    });
  });

  describe('GET /bookings/:id/slip', () => {
    it('rejects with 401 when no Authorization header is present', async () => {
      await request(app.getHttpServer()).get('/bookings/1/slip').expect(401);
      expect(bookingService.getSlipStream).not.toHaveBeenCalled();
    });

    it('rejects with 403 for a valid token with no Admin/Staff role', async () => {
      await request(app.getHttpServer())
        .get('/bookings/1/slip')
        .set('Authorization', `Bearer ${tokenFor('Guest')}`)
        .expect(403);
      expect(bookingService.getSlipStream).not.toHaveBeenCalled();
    });

    it('streams the slip with the correct Content-Type for an authorized Admin', async () => {
      const stream = new PassThrough();
      bookingService.getSlipStream.mockResolvedValue({ stream, mimeType: 'image/png' });
      const reqPromise = request(app.getHttpServer())
        .get('/bookings/1/slip')
        .set('Authorization', `Bearer ${tokenFor('Admin')}`)
        .expect(200);
      stream.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const res = await reqPromise;
      expect(res.headers['content-type']).toContain('image/png');
    });

    it('propagates 404 when no slip has been uploaded', async () => {
      bookingService.getSlipStream.mockRejectedValue(
        new NotFoundException('No payment slip uploaded for this booking'),
      );
      await request(app.getHttpServer())
        .get('/bookings/1/slip')
        .set('Authorization', `Bearer ${tokenFor('Staff')}`)
        .expect(404);
    });
  });
});
