import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomService } from './room.service';

describe('RoomService', () => {
  let service: RoomService;
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RoomService,
        { provide: getRepositoryToken(Room), useValue: repo },
        SecurityLogger,
      ],
    }).compile();
    service = moduleRef.get(RoomService);
  });

  it('lists rooms filtered by roomTypeId and status', async () => {
    repo.find.mockResolvedValue([{ roomId: 1 }]);

    await service.findAll({ roomTypeId: 1, status: RoomStatus.Available });

    expect(repo.find).toHaveBeenCalledWith({
      where: { roomTypeId: 1, status: RoomStatus.Available },
    });
  });

  it('lists all rooms when no filters are given', async () => {
    repo.find.mockResolvedValue([]);

    await service.findAll({});

    expect(repo.find).toHaveBeenCalledWith({ where: {} });
  });

  it('throws NotFoundException for an unknown room id', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findById(999)).rejects.toThrow(NotFoundException);
  });

  it('defaults a new room to Available status when none is given', async () => {
    repo.create.mockImplementation((entity) => entity);
    repo.save.mockImplementation((entity) => Promise.resolve({ ...entity, roomId: 1 }));

    const result = await service.create({ roomTypeId: 1, roomNumber: '301', floor: 3 }, 1);

    expect(result.status).toBe(RoomStatus.Available);
  });
});
