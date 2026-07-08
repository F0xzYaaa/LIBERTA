import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryResponseDto {
  @ApiProperty()
  arrivalsToday: number;

  @ApiProperty()
  departuresToday: number;

  @ApiProperty()
  pendingPaymentConfirmations: number;

  @ApiProperty()
  occupiedRoomsToday: number;

  @ApiProperty()
  totalActiveRooms: number;

  @ApiProperty()
  occupancyRatePercent: number;

  @ApiProperty()
  revenueTodayConfirmed: number;
}
