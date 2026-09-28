import { ApiProperty } from '@nestjs/swagger';

export class BookingsByStatusResponseDto {
  @ApiProperty()
  Draft: number;

  @ApiProperty()
  Reserved: number;

  @ApiProperty()
  CheckedIn: number;

  @ApiProperty()
  CheckedOut: number;

  @ApiProperty()
  Cancelled: number;

  @ApiProperty()
  NoShow: number;

  @ApiProperty()
  Expired: number;
}
