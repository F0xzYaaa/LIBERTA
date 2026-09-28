import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class LookupGuestDto {
  @ApiProperty()
  @IsInt()
  guestId: number;

  @ApiProperty({ description: "Guest's phone or email, either matches" })
  @IsString()
  contact: string;
}
