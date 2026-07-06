import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Length } from 'class-validator';
import { RoomStatus } from '../entities/room.entity';

export class CreateRoomDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  roomTypeId: number;

  @ApiProperty({ example: '301' })
  @IsString()
  @Length(1, 10)
  roomNumber: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  floor: number;

  @ApiProperty({ enum: RoomStatus, required: false })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;
}
