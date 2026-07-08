import { ApiProperty } from '@nestjs/swagger';

// Never includes passwordHash — this is the only shape employee data leaves the service in.
export class EmployeeSummaryResponseDto {
  @ApiProperty()
  employeeId: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty()
  roleId: number;

  @ApiProperty()
  roleName: string;

  @ApiProperty()
  mfaEnabled: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
