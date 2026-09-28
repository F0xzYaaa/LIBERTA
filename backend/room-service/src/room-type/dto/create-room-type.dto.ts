import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'Sea View Suite' })
  @IsString()
  @Length(1, 50)
  typeName: string;

  @ApiProperty({ example: 4500.0 })
  @IsNumber()
  @Min(0)
  pricePerNight: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  packageDetails?: Record<string, unknown>;
}
