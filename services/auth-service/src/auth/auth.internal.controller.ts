import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { IssueTokenDto } from './dto/issue-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { InternalKeyGuard } from './guards/internal-key.guard';

/**
 * Internal-only endpoints for service-to-service calls (e.g. mfa-service).
 * Must never be routed through Nginx to the public internet — see docs/DEPLOYMENT.md
 * and the Stage 2 security audit for verification of this boundary.
 */
@ApiExcludeController()
@Controller('auth/internal')
@UseGuards(InternalKeyGuard)
export class AuthInternalController {
  constructor(private readonly authService: AuthService) {}

  @Post('issue-token')
  async issueToken(@Body() dto: IssueTokenDto): Promise<TokenResponseDto> {
    return this.authService.issueTokenForEmployee(dto.employeeId);
  }
}
