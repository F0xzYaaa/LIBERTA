import { ApiProperty } from '@nestjs/swagger';

export class GuestResponseDto {
  @ApiProperty()
  guestId: number;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty()
  loyaltyPoints: number;
}
