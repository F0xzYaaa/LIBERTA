import { ApiProperty } from '@nestjs/swagger';

export class OccupancyDayDto {
  @ApiProperty({ example: '2026-07-01' })
  date: string;

  @ApiProperty()
  occupiedRooms: number;

  @ApiProperty()
  totalActiveRooms: number;

  @ApiProperty()
  occupancyRatePercent: number;
}

export class OccupancyResponseDto {
  @ApiProperty({ example: '2026-07-01' })
  from: string;

  @ApiProperty({ example: '2026-07-31' })
  to: string;

  @ApiProperty({ type: [OccupancyDayDto] })
  days: OccupancyDayDto[];
}
