import { ApiProperty } from '@nestjs/swagger';

/** Mirrors auth-service's TokenResponseDto — mfa-service relays this shape unchanged. */
export class TokenResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;
}
