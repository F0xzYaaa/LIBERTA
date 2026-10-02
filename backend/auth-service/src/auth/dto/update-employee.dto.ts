import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateEmployeeDto {
  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, example: 2 })
  @IsOptional()
  @IsInt()
  roleId?: number;

  @ApiProperty({ required: false, example: 'Sirinya Thongchai' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  fullName?: string;

  @ApiProperty({ required: false, example: 'sirinya@libertahuahin.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Send null or an empty string to clear the phone number. */
  @ApiProperty({ required: false, nullable: true, example: '081-999-8888' })
  @IsOptional()
  @IsString()
  // Same 9-20 length rule as registration, or empty to clear.
  @Matches(/^$|^.{9,20}$/, { message: 'phone must be 9-20 characters, or empty to clear it' })
  phone?: string | null;
}
