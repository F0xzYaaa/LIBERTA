import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class FindAvailableRoomDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  roomTypeId: number;

  @ApiProperty({ example: '2026-07-10' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-07-13' })
  @IsDateString()
  checkOut: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numGuests?: number;
}
