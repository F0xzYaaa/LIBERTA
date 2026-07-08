import { ApiProperty } from '@nestjs/swagger';

export class RoomImageResponseDto {
  @ApiProperty()
  imageId: number;

  @ApiProperty()
  roomId: number;

  @ApiProperty({ example: '/uploads/rooms/550e8400-e29b-41d4-a716-446655440000.jpg' })
  imagePath: string;

  @ApiProperty({ nullable: true, type: String })
  caption: string | null;

  @ApiProperty()
  isPrimary: boolean;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty()
  uploadedAt: Date;
}
