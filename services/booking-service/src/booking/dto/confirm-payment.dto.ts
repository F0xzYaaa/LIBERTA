import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ConfirmPaymentDto {
  // Documents the multipart schema for Swagger only — the actual file arrives via
  // @UploadedFile(), not as a validated property on this DTO instance.
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  file?: unknown;

  @ApiProperty({
    example: 'PromptPay 08/07 14:32',
    description: 'Staff note on payment verification',
  })
  @IsString()
  @MaxLength(255)
  paymentNote: string;
}
