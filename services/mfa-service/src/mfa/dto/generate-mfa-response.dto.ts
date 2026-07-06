import { ApiProperty } from '@nestjs/swagger';

export class GenerateMfaResponseDto {
  @ApiProperty({ description: 'data: URI PNG QR code — scan with an authenticator app' })
  qrCodeDataUri: string;

  @ApiProperty({ description: 'Base32 secret for manual entry if the QR code cannot be scanned' })
  manualEntryKey: string;

  @ApiProperty({
    type: [String],
    description: '10 one-time backup codes, shown exactly once — store them safely',
  })
  backupCodes: string[];
}
