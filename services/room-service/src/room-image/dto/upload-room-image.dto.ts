import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UploadRoomImageDto {
  // Documents the multipart schema for Swagger only — the actual file arrives via
  // @UploadedFile(), not as a validated property on this DTO instance.
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  file?: unknown;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  caption?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPrimary?: boolean;
}
