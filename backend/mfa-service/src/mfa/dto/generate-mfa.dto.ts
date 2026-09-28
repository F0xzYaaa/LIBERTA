import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GenerateMfaDto {
  @ApiProperty({
    description:
      'The tempToken issued by POST /auth/login — proves password verification already happened for this employee.',
  })
  @IsString()
  tempToken: string;
}
