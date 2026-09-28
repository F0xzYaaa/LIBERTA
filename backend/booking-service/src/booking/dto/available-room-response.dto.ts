import { ApiProperty } from '@nestjs/swagger';

export class AvailableRoomResponseDto {
  @ApiProperty()
  roomId: number;

  @ApiProperty()
  roomNumber: string;

  @ApiProperty()
  roomTypeId: number;

  @ApiProperty()
  typeName: string;

  @ApiProperty()
  pricePerNight: number;

  @ApiProperty()
  capacity: number;

  @ApiProperty()
  nights: number;

  @ApiProperty()
  totalPrice: number;
}
