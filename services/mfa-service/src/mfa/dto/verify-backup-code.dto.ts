import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyBackupCodeDto {
  @ApiProperty()
  @IsString()
  tempToken: string;

  @ApiProperty({ example: 'A1B2-C3D4' })
  @IsString()
  @Length(8, 12)
  backupCode: string;
}
