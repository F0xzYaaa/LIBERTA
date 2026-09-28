import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../entities/booking.entity';

export class ConfirmPaymentResponseDto {
  @ApiProperty()
  bookingId: number;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.Reserved })
  status: BookingStatus;

  @ApiProperty()
  paymentConfirmedAt: Date;

  @ApiProperty()
  paymentConfirmedBy: number;

  @ApiProperty({ example: true })
  hasSlip: boolean;
}
