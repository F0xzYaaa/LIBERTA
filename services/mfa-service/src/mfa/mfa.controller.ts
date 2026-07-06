import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminResetMfaDto } from './dto/admin-reset-mfa.dto';
import { GenerateMfaDto } from './dto/generate-mfa.dto';
import { GenerateMfaResponseDto } from './dto/generate-mfa-response.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { VerifyBackupCodeDto } from './dto/verify-backup-code.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles, RolesGuard } from './guards/roles.guard';
import { MfaService } from './mfa.service';
import { JwtPayload } from './strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('mfa')
@Controller('mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('generate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Self-enrollment: generate a TOTP secret + backup codes using a tempToken',
  })
  @ApiResponse({ status: 201, type: GenerateMfaResponseDto })
  @ApiResponse({ status: 409, description: 'Employee already has an activated MFA secret' })
  async generate(@Body() dto: GenerateMfaDto): Promise<GenerateMfaResponseDto> {
    return this.mfaService.generate(dto.tempToken);
  }

  @Post('admin-reset')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only: wipe and regenerate MFA enrollment for another employee' })
  @ApiResponse({ status: 201, type: GenerateMfaResponseDto })
  async adminReset(
    @Body() dto: AdminResetMfaDto,
    @Req() req: RequestWithUser,
  ): Promise<GenerateMfaResponseDto> {
    return this.mfaService.adminReset(dto, req.user.sub);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Step 2 of staff/admin login: verify a TOTP code, receive JWT tokens' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired tempToken, or invalid TOTP code' })
  @ApiResponse({ status: 429, description: 'Too many failed attempts against this tempToken' })
  async verify(@Body() dto: VerifyMfaDto): Promise<TokenResponseDto> {
    return this.mfaService.verifyTotp(dto.tempToken, dto.totpCode);
  }

  @Post('backup-code/verify')
  @ApiOperation({ summary: 'Alternative to TOTP: verify a one-time backup code' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Invalid tempToken or unknown/already-used backup code',
  })
  async verifyBackupCode(@Body() dto: VerifyBackupCodeDto): Promise<TokenResponseDto> {
    return this.mfaService.verifyBackupCode(dto.tempToken, dto.backupCode);
  }
}
