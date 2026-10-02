import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { EmployeeSummaryResponseDto } from './dto/employee-summary-response.dto';
import { FindAllEmployeesDto } from './dto/find-all-employees.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RegisterEmployeeDto } from './dto/register-employee.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
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
  @ApiResponse({
    status: 429,
    description: 'Too many failed login attempts for this username — locked out temporarily',
  })
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

  @Get('employees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only: list employees, optionally filtered by role/active state' })
  @ApiResponse({ status: 200, type: [EmployeeSummaryResponseDto] })
  async findAllEmployees(
    @Query() filters: FindAllEmployeesDto,
  ): Promise<EmployeeSummaryResponseDto[]> {
    return this.authService.findAllEmployees(filters);
  }

  @Get('employees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only: get a single employee by id' })
  @ApiResponse({ status: 200, type: EmployeeSummaryResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findEmployeeById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<EmployeeSummaryResponseDto> {
    return this.authService.findEmployeeById(id);
  }

  @Patch('employees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only: activate/deactivate an employee or change their role' })
  @ApiResponse({ status: 200, type: EmployeeSummaryResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 400, description: 'roleId does not reference an existing Role' })
  @ApiResponse({ status: 403, description: 'Admins cannot modify their own account' })
  async updateEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: RequestWithUser,
  ): Promise<EmployeeSummaryResponseDto> {
    return this.authService.updateEmployee(id, dto, req.user.sub);
  }

  @Delete('employees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin-only: delete an employee who has no booking history' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 403, description: 'Admins cannot delete their own account' })
  @ApiResponse({ status: 409, description: 'Employee appears in booking history' })
  async deleteEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.authService.deleteEmployee(id, req.user.sub);
  }
}
