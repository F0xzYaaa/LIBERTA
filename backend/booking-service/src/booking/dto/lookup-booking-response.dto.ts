import { ApiProperty } from '@nestjs/swagger';

/** Deliberately limited — no guestId, no internal booking_id, no other guest's data. */
export class LookupBookingResponseDto {
  @ApiProperty()
  reference: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  checkIn: string;

  @ApiProperty()
  checkOut: string;

  @ApiProperty()
  roomNumber: string;

  @ApiProperty()
  roomType: string;

  @ApiProperty()
  totalPrice: number;
}
