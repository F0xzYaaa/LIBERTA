import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room, RoomStatus } from './entities/room.entity';

interface FindAllFilters {
  roomTypeId?: number;
  status?: RoomStatus;
}

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room) private readonly repo: Repository<Room>,
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
}
