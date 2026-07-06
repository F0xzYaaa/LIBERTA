import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class RegisterGuestDto {
  @ApiProperty({ example: 'Warinthorn' })
  @IsString()
  @Length(1, 50)
  firstName: string;

  @ApiProperty({ example: 'Chaiyasit' })
  @IsString()
  @Length(1, 50)
  lastName: string;

  @ApiProperty({ example: '089-111-2222' })
  @IsString()
  @Matches(/^[0-9+\-() ]{9,20}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @ApiProperty({ example: 'warinthorn.c@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '1234567890123', required: false })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  idCard?: string;

  @ApiProperty({ example: 'Thai', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  nationality?: string;
}
