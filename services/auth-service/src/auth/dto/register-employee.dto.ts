import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class RegisterEmployeeDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  roleId: number;

  @ApiProperty({ example: 'staff03' })
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'username may only contain letters, numbers, underscore' })
  username: string;

  @ApiProperty({ example: 'a-strong-password' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Sirinya Thongchai' })
  @IsString()
  @Length(1, 100)
  fullName: string;

  @ApiProperty({ example: 'sirinya@libertahuahin.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '081-999-8888', required: false })
  @IsOptional()
  @IsString()
  @Length(9, 20)
  phone?: string;
}
