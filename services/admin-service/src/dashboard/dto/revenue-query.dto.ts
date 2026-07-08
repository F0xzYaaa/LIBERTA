import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum } from 'class-validator';

export enum RevenueGroupBy {
  Day = 'day',
  Month = 'month',
}

export class RevenueQueryDto {
  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  to: string;

  @ApiProperty({ enum: RevenueGroupBy, example: RevenueGroupBy.Day })
  @IsEnum(RevenueGroupBy)
  groupBy: RevenueGroupBy;
}
