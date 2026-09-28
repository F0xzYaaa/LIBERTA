import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { Guest } from './entities/guest.entity';
import { GuestService } from './guest.service';

describe('GuestService', () => {
  let service: GuestService;
  let guestRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    guestRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GuestService,
        { provide: getRepositoryToken(Guest), useValue: guestRepo },
        SecurityLogger,
      ],
    }).compile();

    service = moduleRef.get(GuestService);
  });

  describe('register', () => {
    const dto = { firstName: 'Warinthorn', lastName: 'Chaiyasit', phone: '089-111-2222' };

    it('registers a guest with just name and phone, defaulting nationality to Thai', async () => {
      guestRepo.create.mockImplementation((entity) => entity);
      guestRepo.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity, guestId: 1, loyaltyPoints: 0 }),
      );

      const result = await service.register(dto);

      expect(result).toEqual({
        guestId: 1,
        firstName: 'Warinthorn',
        lastName: 'Chaiyasit',
        phone: '089-111-2222',
        email: null,
        loyaltyPoints: 0,
      });
      expect(guestRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects a duplicate idCard with 409 Conflict', async () => {
      guestRepo.findOne.mockResolvedValue({ guestId: 5, idCard: '1234567890123' });

      await expect(service.register({ ...dto, idCard: '1234567890123' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('allows registration without an idCard (nullable, not checked)', async () => {
      guestRepo.create.mockImplementation((entity) => entity);
      guestRepo.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity, guestId: 2, loyaltyPoints: 0 }),
      );

      await service.register(dto);

      expect(guestRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('lookup', () => {
    it('returns the guest profile when guestId and contact both match', async () => {
      guestRepo.findOne.mockResolvedValue({
        guestId: 1,
        firstName: 'Warinthorn',
        lastName: 'Chaiyasit',
        phone: '089-111-2222',
        email: null,
        loyaltyPoints: 120,
      });

      const result = await service.lookup({ guestId: 1, contact: '089-111-2222' });

      expect(result.guestId).toBe(1);
      expect(result.loyaltyPoints).toBe(120);
    });

    it('matches on email as well as phone', async () => {
      guestRepo.findOne.mockResolvedValue({
        guestId: 1,
        firstName: 'Warinthorn',
        lastName: 'Chaiyasit',
        phone: '089-111-2222',
        email: 'warinthorn.c@example.com',
        loyaltyPoints: 0,
      });

      const result = await service.lookup({ guestId: 1, contact: 'warinthorn.c@example.com' });

      expect(result.guestId).toBe(1);
    });

    it('throws NotFoundException when the guest does not exist', async () => {
      guestRepo.findOne.mockResolvedValue(null);

      await expect(service.lookup({ guestId: 999, contact: 'anything' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException (not a hint) when guestId is valid but contact does not match', async () => {
      guestRepo.findOne.mockResolvedValue({
        guestId: 1,
        phone: '089-111-2222',
        email: null,
      });

      await expect(service.lookup({ guestId: 1, contact: 'wrong-contact' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
