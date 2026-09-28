import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LookupBookingDto {
  @ApiProperty({ example: 'BK-2026-000042' })
  @IsString()
  reference: string;

  @ApiProperty({ example: '089-111-2222', description: "Guest's phone or email, either matches" })
  @IsString()
  contact: string;
}
