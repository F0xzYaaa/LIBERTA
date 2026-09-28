import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class IssueTokenDto {
  @ApiProperty()
  @IsInt()
  employeeId: number;
}
