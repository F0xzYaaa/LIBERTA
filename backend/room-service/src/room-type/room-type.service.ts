import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { RoomType } from './entities/room-type.entity';

// MySQL ER_ROW_IS_REFERENCED_2: the row is still referenced by a foreign key.
const ER_ROW_IS_REFERENCED = 1451;

@Injectable()
export class RoomTypeService {
  constructor(
    @InjectRepository(RoomType) private readonly repo: Repository<RoomType>,
    private readonly securityLogger: SecurityLogger,
  ) {}

  findAll(): Promise<RoomType[]> {
    return this.repo.find();
  }

  async findById(roomTypeId: number): Promise<RoomType> {
    const roomType = await this.repo.findOne({ where: { roomTypeId } });
    if (!roomType) {
      throw new NotFoundException('Room type not found');
    }
    return roomType;
  }

  async create(dto: CreateRoomTypeDto, actingEmployeeId: number): Promise<RoomType> {
    const roomType = this.repo.create({
      typeName: dto.typeName,
      pricePerNight: dto.pricePerNight,
      capacity: dto.capacity,
      description: dto.description ?? null,
      packageDetails: dto.packageDetails ?? null,
    });
    const saved = await this.repo.save(roomType);
    this.securityLogger.log('admin_action_room_type_create', {
      actingEmployeeId,
      roomTypeId: saved.roomTypeId,
    });
    return saved;
  }

  async update(
    roomTypeId: number,
    dto: UpdateRoomTypeDto,
    actingEmployeeId: number,
  ): Promise<RoomType> {
    const roomType = await this.findById(roomTypeId);
    Object.assign(roomType, dto);
    const saved = await this.repo.save(roomType);
    this.securityLogger.log('admin_action_room_type_update', { actingEmployeeId, roomTypeId });
    return saved;
  }

  /**
   * Deletes a room type only when no room uses it. Room has a plain FK to
   * RoomType, so MySQL refuses the delete while rooms remain; that refusal is
   * mapped to 409 rather than pre-checked, so the rule cannot race.
   */
  async delete(roomTypeId: number, actingEmployeeId: number): Promise<void> {
    const roomType = await this.findById(roomTypeId);
    try {
      await this.repo.delete({ roomTypeId });
    } catch (err) {
      if ((err as { errno?: number })?.errno === ER_ROW_IS_REFERENCED) {
        throw new ConflictException(
          `Cannot delete room type "${roomType.typeName}": rooms still use it. Delete or reassign those rooms first.`,
        );
      }
      throw err;
    }
    this.securityLogger.log('admin_action_room_type_delete', { actingEmployeeId, roomTypeId });
  }
}
