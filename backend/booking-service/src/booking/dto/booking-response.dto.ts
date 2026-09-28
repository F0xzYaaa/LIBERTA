import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../entities/booking.entity';

class GuestSummaryDto {
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
}

class RoomTypeSummaryDto {
  @ApiProperty()
  roomTypeId: number;

  @ApiProperty()
  typeName: string;

  @ApiProperty()
  pricePerNight: number;
}

class RoomSummaryDto {
  @ApiProperty()
  roomId: number;

  @ApiProperty()
  roomNumber: string;

  @ApiProperty({ type: RoomTypeSummaryDto })
  roomType: RoomTypeSummaryDto;
}

// Staff/Admin booking detail shape. Never includes slipImagePath (the raw
// filesystem path) — only a derived hasSlip boolean. The slip itself is only
// ever readable through the authenticated GET /bookings/:id/slip endpoint.
export class BookingResponseDto {
  @ApiProperty()
  bookingId: number;

  @ApiProperty({ type: GuestSummaryDto })
  guest: GuestSummaryDto;

  @ApiProperty({ type: RoomSummaryDto })
  room: RoomSummaryDto;

  @ApiProperty()
  checkIn: string;

  @ApiProperty()
  checkOut: string;

  @ApiProperty()
  numGuests: number;

  @ApiProperty()
  totalPrice: number;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty({ nullable: true })
  lockExpiresAt: Date | null;

  @ApiProperty({ nullable: true })
  paymentNote: string | null;

  @ApiProperty({ example: false })
  hasSlip: boolean;

  @ApiProperty({ nullable: true })
  paymentConfirmedBy: number | null;

  @ApiProperty({ nullable: true })
  paymentConfirmedAt: Date | null;

  @ApiProperty({ nullable: true })
  specialRequest: string | null;

  @ApiProperty({ nullable: true })
  createdBy: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
