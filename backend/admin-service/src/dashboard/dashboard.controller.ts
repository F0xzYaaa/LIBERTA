import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { BookingsByStatusResponseDto } from './dto/bookings-by-status-response.dto';
import { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto';
import { OccupancyQueryDto } from './dto/occupancy-query.dto';
import { OccupancyResponseDto } from './dto/occupancy-response.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { RevenueResponseDto } from './dto/revenue-response.dto';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Staff')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: "Staff/Admin: today's key operational metrics (Redis-cached 60s)" })
  @ApiResponse({ status: 200, type: DashboardSummaryResponseDto })
  async getSummary(): Promise<DashboardSummaryResponseDto> {
    return this.dashboardService.getSummary();
  }

  @Get('occupancy')
  @ApiOperation({ summary: 'Staff/Admin: daily occupancy rate over a date range' })
  @ApiResponse({ status: 200, type: OccupancyResponseDto })
  @ApiResponse({ status: 400, description: 'to before from, or range exceeds 366 days' })
  async getOccupancy(@Query() query: OccupancyQueryDto): Promise<OccupancyResponseDto> {
    return this.dashboardService.getOccupancy(query);
  }

  @Get('revenue')
  @ApiOperation({
    summary: 'Staff/Admin: confirmed revenue grouped by day or month (source: paymentConfirmedAt)',
  })
  @ApiResponse({ status: 200, type: RevenueResponseDto })
  @ApiResponse({ status: 400, description: 'to before from, or range exceeds 366 days' })
  async getRevenue(@Query() query: RevenueQueryDto): Promise<RevenueResponseDto> {
    return this.dashboardService.getRevenue(query);
  }

  @Get('bookings-by-status')
  @ApiOperation({ summary: 'Staff/Admin: booking counts grouped by status' })
  @ApiResponse({ status: 200, type: BookingsByStatusResponseDto })
  async getBookingsByStatus(): Promise<BookingsByStatusResponseDto> {
    return this.dashboardService.getBookingsByStatus();
  }
}
