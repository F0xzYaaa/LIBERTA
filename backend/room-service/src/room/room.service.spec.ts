import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mkdtemp, readdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { SecurityLogger } from '../common/security-logger.service';
import { RoomImage } from '../room-image/entities/room-image.entity';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomService } from './room.service';

describe('RoomService', () => {
  let service: RoomService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let imageRepo: { find: jest.Mock };
  let uploadDir: string;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    imageRepo = { find: jest.fn().mockResolvedValue([]) };
    uploadDir = await mkdtemp(path.join(tmpdir(), 'room-del-'));
    const moduleRef = await Test.createTestingModule({
      providers: [
        RoomService,
        { provide: getRepositoryToken(Room), useValue: repo },
        { provide: getRepositoryToken(RoomImage), useValue: imageRepo },
        { provide: ConfigService, useValue: { get: () => uploadDir } },
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

  describe('delete', () => {
    it('deletes a room without bookings and removes its image files', async () => {
      repo.findOne.mockResolvedValue({ roomId: 5, roomNumber: '305' });
      imageRepo.find.mockResolvedValue([{ imagePath: '/uploads/rooms/a.jpg' }]);
      repo.delete.mockResolvedValue({ affected: 1 });
      await writeFile(path.join(uploadDir, 'a.jpg'), 'x');
      await writeFile(path.join(uploadDir, 'keep.jpg'), 'x');

      await service.delete(5, 1);

      expect(repo.delete).toHaveBeenCalledWith({ roomId: 5 });
      expect(await readdir(uploadDir)).toEqual(['keep.jpg']);
    });

    it('returns 409 and keeps image files when the room has bookings', async () => {
      repo.findOne.mockResolvedValue({ roomId: 5, roomNumber: '305' });
      imageRepo.find.mockResolvedValue([{ imagePath: '/uploads/rooms/a.jpg' }]);
      repo.delete.mockRejectedValue(Object.assign(new Error('FK'), { errno: 1451 }));
      await writeFile(path.join(uploadDir, 'a.jpg'), 'x');

      await expect(service.delete(5, 1)).rejects.toThrow(ConflictException);
      expect(await readdir(uploadDir)).toEqual(['a.jpg']);
    });

    it('does not fail when an image file is already missing', async () => {
      repo.findOne.mockResolvedValue({ roomId: 5, roomNumber: '305' });
      imageRepo.find.mockResolvedValue([{ imagePath: '/uploads/rooms/gone.jpg' }]);
      repo.delete.mockResolvedValue({ affected: 1 });

      await expect(service.delete(5, 1)).resolves.toBeUndefined();
    });

    it('throws NotFoundException for an unknown room', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.delete(999, 1)).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
