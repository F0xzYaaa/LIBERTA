import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { RoomType } from './entities/room-type.entity';

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
}
