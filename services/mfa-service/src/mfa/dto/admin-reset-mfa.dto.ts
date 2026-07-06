import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AdminResetMfaDto {
  @ApiProperty({ description: 'Employee whose MFA enrollment is being reset by an admin' })
  @IsInt()
  employeeId: number;
}
