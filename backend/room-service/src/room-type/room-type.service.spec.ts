import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { RoomType } from './entities/room-type.entity';
import { RoomTypeService } from './room-type.service';

describe('RoomTypeService', () => {
  let service: RoomTypeService;
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RoomTypeService,
        { provide: getRepositoryToken(RoomType), useValue: repo },
        SecurityLogger,
      ],
    }).compile();
    service = moduleRef.get(RoomTypeService);
  });

  it('lists all room types', async () => {
    repo.find.mockResolvedValue([{ roomTypeId: 1, typeName: 'Sea View Suite' }]);

    const result = await service.findAll();

    expect(result).toHaveLength(1);
  });

  it('throws NotFoundException for an unknown room type id', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findById(999)).rejects.toThrow(NotFoundException);
  });

  it('creates a room type with packageDetails round-tripped as JSON', async () => {
    const dto = {
      typeName: 'Forest View Deluxe',
      pricePerNight: 3200,
      capacity: 2,
      packageDetails: { amenities: ['Garden view', 'Queen bed'], breakfast_included: true },
    };
    repo.create.mockImplementation((entity) => entity);
    repo.save.mockImplementation((entity) => Promise.resolve({ ...entity, roomTypeId: 2 }));

    const result = await service.create(dto, 1);

    expect(result.packageDetails).toEqual(dto.packageDetails);
  });

  it('updates only the fields provided', async () => {
    repo.findOne.mockResolvedValue({ roomTypeId: 1, typeName: 'Old Name', pricePerNight: 1000 });
    repo.save.mockImplementation((entity) => Promise.resolve(entity));

    const result = await service.update(1, { pricePerNight: 1500 }, 1);

    expect(result.typeName).toBe('Old Name');
    expect(result.pricePerNight).toBe(1500);
  });
});
