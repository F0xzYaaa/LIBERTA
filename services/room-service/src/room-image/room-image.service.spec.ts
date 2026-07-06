import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fsPromises from 'fs/promises';
import { SecurityLogger } from '../common/security-logger.service';
import { Room } from '../room/entities/room.entity';
import { RoomImage } from './entities/room-image.entity';
import { RoomImageService } from './room-image.service';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

describe('RoomImageService', () => {
  let service: RoomImageService;
  let imageRepo: { create: jest.Mock; save: jest.Mock };
  let roomRepo: { findOne: jest.Mock };
  let config: { get: jest.Mock };

  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
  const notAnImageBuffer = Buffer.from('this is just text, not an image');

  beforeEach(async () => {
    imageRepo = { create: jest.fn(), save: jest.fn() };
    roomRepo = { findOne: jest.fn() };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number> = {
          ROOM_IMAGE_UPLOAD_DIR: '/app/uploads/rooms',
          ROOM_IMAGE_MAX_SIZE_BYTES: 5 * 1024 * 1024,
        };
        return values[key];
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RoomImageService,
        { provide: getRepositoryToken(RoomImage), useValue: imageRepo },
        { provide: getRepositoryToken(Room), useValue: roomRepo },
        { provide: ConfigService, useValue: config },
        SecurityLogger,
      ],
    }).compile();

    service = moduleRef.get(RoomImageService);
  });

  it('throws NotFoundException when the room does not exist', async () => {
    roomRepo.findOne.mockResolvedValue(null);

    await expect(
      service.upload(999, { buffer: jpegBuffer, size: jpegBuffer.length }, {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a file exceeding the configured size limit', async () => {
    roomRepo.findOne.mockResolvedValue({ roomId: 1 });

    await expect(
      service.upload(1, { buffer: jpegBuffer, size: 6 * 1024 * 1024 }, {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects content that is not a recognized image, regardless of declared MIME type', async () => {
    roomRepo.findOne.mockResolvedValue({ roomId: 1 });

    await expect(
      service.upload(1, { buffer: notAnImageBuffer, size: notAnImageBuffer.length }, {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a real JPEG, writes it with a randomized filename, and records the sniffed MIME type', async () => {
    roomRepo.findOne.mockResolvedValue({ roomId: 1 });
    imageRepo.create.mockImplementation((entity) => entity);
    imageRepo.save.mockImplementation((entity) => Promise.resolve({ ...entity, imageId: 1 }));

    const result = await service.upload(
      1,
      { buffer: jpegBuffer, size: jpegBuffer.length },
      { caption: 'Sea view', isPrimary: true },
    );

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.imagePath).toMatch(/^\/uploads\/rooms\/[0-9a-f-]+\.jpg$/);
    expect(result.caption).toBe('Sea view');
    expect(result.isPrimary).toBe(true);
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('uploads'),
      jpegBuffer,
    );
  });

  it('accepts a real PNG', async () => {
    roomRepo.findOne.mockResolvedValue({ roomId: 1 });
    imageRepo.create.mockImplementation((entity) => entity);
    imageRepo.save.mockImplementation((entity) => Promise.resolve({ ...entity, imageId: 2 }));

    const result = await service.upload(1, { buffer: pngBuffer, size: pngBuffer.length }, {});

    expect(result.mimeType).toBe('image/png');
  });
});
