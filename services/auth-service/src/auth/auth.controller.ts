import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RegisterEmployeeDto } from './dto/register-employee.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles, RolesGuard } from './guards/roles.guard';
import { JwtPayload } from './strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Step 1 of staff/admin login: verify password, get a tempToken' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid username or password' })
  @ApiResponse({ status: 403, description: 'Employee account is deactivated' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    return this.authService.login(dto, req.ip);
  }

  @Post('register-employee')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only: create a new staff/admin account' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: 'Username or email already in use' })
  async registerEmployee(@Body() dto: RegisterEmployeeDto, @Req() req: RequestWithUser) {
    return this.authService.registerEmployee(dto, req.user.sub);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token for a new access+refresh pair' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or already-rotated refresh token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the current refresh token, forcing re-login on next expiry' })
  @ApiResponse({ status: 200 })
  async logout(@Req() req: RequestWithUser): Promise<{ message: string }> {
    await this.authService.logout(req.user.sub);
    return { message: 'Logged out' };
  }
}
