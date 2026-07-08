import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional } from 'class-validator';

export class FindAllEmployeesDto {
  @ApiProperty({ required: false, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roleId?: number;

  @ApiProperty({ required: false, example: 'true' })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
