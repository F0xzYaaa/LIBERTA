import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { Repository } from 'typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { Room } from '../room/entities/room.entity';
import { RoomImageResponseDto } from './dto/room-image-response.dto';
import { UploadRoomImageDto } from './dto/upload-room-image.dto';
import { RoomImage } from './entities/room-image.entity';

const MAGIC_BYTES: Record<string, { ext: string; check: (buf: Buffer) => boolean }> = {
  'image/jpeg': {
    ext: 'jpg',
    check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  'image/png': {
    ext: 'png',
    check: (buf) =>
      buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  },
  'image/webp': {
    ext: 'webp',
    check: (buf) =>
      buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP',
  },
};

export interface UploadedFile {
  buffer: Buffer;
  size: number;
}

@Injectable()
export class RoomImageService {
  constructor(
    @InjectRepository(RoomImage) private readonly imageRepo: Repository<RoomImage>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    private readonly config: ConfigService,
    private readonly securityLogger: SecurityLogger,
  ) {}

  async upload(
    roomId: number,
    file: UploadedFile,
    dto: UploadRoomImageDto,
    actingEmployeeId?: number,
  ): Promise<RoomImage> {
    const room = await this.roomRepo.findOne({ where: { roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const maxSize = this.config.get<number>('ROOM_IMAGE_MAX_SIZE_BYTES') as number;
    if (file.size > maxSize) {
      throw new BadRequestException(`File exceeds the maximum size of ${maxSize} bytes`);
    }

    // Sniff actual file content instead of trusting the client-supplied MIME type / extension.
    const detected = Object.entries(MAGIC_BYTES).find(([, spec]) => spec.check(file.buffer));
    if (!detected) {
      throw new BadRequestException('File is not a recognized JPEG, PNG, or WebP image');
    }
    const [mimeType, spec] = detected;

    const uploadDir = this.config.get<string>('ROOM_IMAGE_UPLOAD_DIR') as string;
    await mkdir(uploadDir, { recursive: true });

    // Filename is always server-generated — the client-supplied filename is never used
    // for the on-disk path, closing off path traversal entirely.
    const filename = `${randomUUID()}.${spec.ext}`;
    const fullPath = path.join(uploadDir, filename);
    await writeFile(fullPath, file.buffer);

    const isPrimary = dto.isPrimary ?? false;
    if (isPrimary) {
      // Only one image per room may be primary — clear any existing one first,
      // otherwise two images can both end up with isPrimary=true.
      await this.imageRepo.update({ roomId, isPrimary: true }, { isPrimary: false });
    }

    const image = this.imageRepo.create({
      roomId,
      imagePath: `/uploads/rooms/${filename}`,
      caption: dto.caption ?? null,
      isPrimary,
      fileSize: file.size,
      mimeType,
    });
    const saved = await this.imageRepo.save(image);

    this.securityLogger.log('admin_action_room_image_upload', {
      actingEmployeeId,
      roomId,
      imageId: saved.imageId,
      mimeType,
      fileSize: file.size,
    });

    return saved;
  }

  async findByRoomId(roomId: number): Promise<RoomImageResponseDto[]> {
    const room = await this.roomRepo.findOne({ where: { roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    // Primary image first within the same display order; a room with zero images
    // simply returns an empty array (the room itself exists, so this is not a 404).
    const images = await this.imageRepo.find({
      where: { roomId },
      order: { displayOrder: 'ASC', isPrimary: 'DESC' },
    });

    return images.map((image) => this.toResponseDto(image));
  }

  private toResponseDto(image: RoomImage): RoomImageResponseDto {
    return {
      imageId: image.imageId,
      roomId: image.roomId,
      imagePath: image.imagePath,
      caption: image.caption,
      isPrimary: image.isPrimary,
      displayOrder: image.displayOrder,
      uploadedAt: image.uploadedAt,
    };
  }
}
