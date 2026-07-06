import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty()
  tempToken: string;

  @ApiProperty({ description: 'True if the employee still needs to complete TOTP verification' })
  mfaRequired: boolean;

  @ApiProperty({
    description: 'True if the employee must enroll in MFA before a JWT can be issued',
  })
  mfaEnrollmentRequired: boolean;
}
