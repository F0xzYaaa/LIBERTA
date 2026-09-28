import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class UpdateEmployeeDto {
  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, example: 2 })
  @IsOptional()
  @IsInt()
  roleId?: number;
}
