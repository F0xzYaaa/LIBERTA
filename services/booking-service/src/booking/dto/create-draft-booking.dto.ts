import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateDraftBookingDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  guestId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  roomId: number;

  @ApiProperty({ example: '2026-07-10' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-07-13' })
  @IsDateString()
  checkOut: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  numGuests: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  specialRequest?: string;
}
