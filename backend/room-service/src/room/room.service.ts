import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import * as path from 'path';
import { FindOptionsWhere, Repository } from 'typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { RoomImage } from '../room-image/entities/room-image.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, RoomStatus } from './entities/room.entity';

// MySQL ER_ROW_IS_REFERENCED_2: the row is still referenced by a foreign key.
const ER_ROW_IS_REFERENCED = 1451;

interface FindAllFilters {
  roomTypeId?: number;
  status?: RoomStatus;
}

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room) private readonly repo: Repository<Room>,
    @InjectRepository(RoomImage) private readonly imageRepo: Repository<RoomImage>,
    private readonly config: ConfigService,
    private readonly securityLogger: SecurityLogger,
  ) {}

  findAll(filters: FindAllFilters): Promise<Room[]> {
    const where: FindOptionsWhere<Room> = {};
    if (filters.roomTypeId !== undefined) where.roomTypeId = filters.roomTypeId;
    if (filters.status !== undefined) where.status = filters.status;
    return this.repo.find({ where });
  }

  async findById(roomId: number): Promise<Room> {
    const room = await this.repo.findOne({ where: { roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  async create(dto: CreateRoomDto, actingEmployeeId: number): Promise<Room> {
    const room = this.repo.create({
      roomTypeId: dto.roomTypeId,
      roomNumber: dto.roomNumber,
      floor: dto.floor,
      status: dto.status ?? RoomStatus.Available,
    });
    const saved = await this.repo.save(room);
    this.securityLogger.log('admin_action_room_create', {
      actingEmployeeId,
      roomId: saved.roomId,
    });
    return saved;
  }

  async update(roomId: number, dto: UpdateRoomDto, actingEmployeeId: number): Promise<Room> {
    const room = await this.findById(roomId);
    Object.assign(room, dto);
    const saved = await this.repo.save(room);
    this.securityLogger.log('admin_action_room_update', { actingEmployeeId, roomId });
    return saved;
  }

  /**
   * Deletes a room only when nothing references it. Bookings keep a plain
   * (non-cascading) FK to Room, so MySQL itself refuses the delete for a room
   * with booking history — that refusal is mapped to 409 instead of being
   * pre-checked, which keeps the rule race-free and the history intact.
   * RoomImage rows cascade in the DB; their files are removed afterwards.
   */
  async delete(roomId: number, actingEmployeeId: number): Promise<void> {
    const room = await this.findById(roomId);
    const images = await this.imageRepo.find({ where: { roomId } });

    try {
      await this.repo.delete({ roomId });
    } catch (err) {
      if ((err as { errno?: number })?.errno === ER_ROW_IS_REFERENCED) {
        throw new ConflictException(
          `Cannot delete room ${room.roomNumber}: it has bookings. Set its status to Out of Service instead.`,
        );
      }
      throw err;
    }

    // Image files are only cleaned up once the DB delete has committed. A file
    // that is already missing is not an error.
    const uploadDir = this.config.get<string>('ROOM_IMAGE_UPLOAD_DIR') as string;
    await Promise.all(
      images.map((image) =>
        unlink(path.join(uploadDir, path.basename(image.imagePath))).catch(() => undefined),
      ),
    );

    this.securityLogger.log('admin_action_room_delete', {
      actingEmployeeId,
      roomId,
      imagesRemoved: images.length,
    });
  }
}
