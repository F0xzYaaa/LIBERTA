import { ApiProperty } from '@nestjs/swagger';

export class CreateDraftResponseDto {
  @ApiProperty()
  bookingId: number;

  @ApiProperty({ example: 'BK-2026-000042' })
  reference: string;

  @ApiProperty()
  lockExpiresAt: Date;

  @ApiProperty()
  totalPrice: number;
}
