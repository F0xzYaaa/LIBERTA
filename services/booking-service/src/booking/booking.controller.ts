import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { BookingService } from './booking.service';
import { CreateDraftBookingDto } from './dto/create-draft-booking.dto';
import { CreateDraftResponseDto } from './dto/create-draft-response.dto';
import { FindAllBookingsDto } from './dto/find-all-bookings.dto';
import { LookupBookingDto } from './dto/lookup-booking.dto';
import { LookupBookingResponseDto } from './dto/lookup-booking-response.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post('draft')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a Draft booking with a 15-minute concurrency-safe lock' })
  @ApiResponse({ status: 201, type: CreateDraftResponseDto })
  @ApiResponse({ status: 409, description: 'Room already locked by another booking' })
  @ApiResponse({ status: 400, description: 'Validation error or capacity exceeded' })
  async createDraft(@Body() dto: CreateDraftBookingDto): Promise<CreateDraftResponseDto> {
    return this.bookingService.createDraft(dto);
  }

  @Post('lookup')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public: look up a booking by reference + phone/email (two-factor)' })
  @ApiResponse({ status: 200, type: LookupBookingResponseDto })
  @ApiResponse({ status: 404, description: 'No match for the reference + contact combination' })
  async lookup(@Body() dto: LookupBookingDto): Promise<LookupBookingResponseDto> {
    return this.bookingService.lookup(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Staff')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff/Admin: list bookings with filters' })
  async findAll(@Query() filters: FindAllBookingsDto) {
    return this.bookingService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Staff')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff/Admin: get full booking details by id' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.bookingService.findById(id);
  }
}
