import { ApiProperty } from '@nestjs/swagger';
import { RevenueGroupBy } from './revenue-query.dto';

export class RevenueBucketDto {
  @ApiProperty({ example: '2026-07-01' })
  period: string;

  @ApiProperty()
  revenue: number;
}

export class RevenueResponseDto {
  @ApiProperty({ example: '2026-07-01' })
  from: string;

  @ApiProperty({ example: '2026-07-31' })
  to: string;

  @ApiProperty({ enum: RevenueGroupBy })
  groupBy: RevenueGroupBy;

  @ApiProperty({ type: [RevenueBucketDto] })
  buckets: RevenueBucketDto[];
}
