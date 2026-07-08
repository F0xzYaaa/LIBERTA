import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { BookingService } from './booking.service';
import { AvailableRoomResponseDto } from './dto/available-room-response.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { ConfirmPaymentResponseDto } from './dto/confirm-payment-response.dto';
import { CreateDraftBookingDto } from './dto/create-draft-booking.dto';
import { CreateDraftResponseDto } from './dto/create-draft-response.dto';
import { FindAllBookingsDto } from './dto/find-all-bookings.dto';
import { FindAvailableRoomDto } from './dto/find-available-room.dto';
import { LookupBookingDto } from './dto/lookup-booking.dto';
import { LookupBookingResponseDto } from './dto/lookup-booking-response.dto';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

// Multer-level cap is a coarse first line of defense; BookingService enforces the
// real, configurable limit (BOOKING_SLIP_MAX_SIZE_BYTES) plus content-based MIME sniffing.
const MULTER_HARD_CAP_BYTES = 10 * 1024 * 1024;

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

  @Get('available-room')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Public: resolve the lowest-numbered available room of a room type for the given dates (preview only, does not lock)',
  })
  @ApiResponse({ status: 200, type: AvailableRoomResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid date range or numGuests exceeds capacity' })
  @ApiResponse({ status: 404, description: 'No available room of this type for the given dates' })
  async findAvailableRoom(@Query() dto: FindAvailableRoomDto): Promise<AvailableRoomResponseDto> {
    return this.bookingService.findAvailableRoom(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Staff')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff/Admin: list bookings with filters' })
  @ApiResponse({ status: 200, type: [BookingResponseDto] })
  async findAll(@Query() filters: FindAllBookingsDto): Promise<BookingResponseDto[]> {
    return this.bookingService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Staff')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff/Admin: get full booking details by id' })
  @ApiResponse({ status: 200, type: BookingResponseDto })
  async findById(@Param('id', ParseIntPipe) id: number): Promise<BookingResponseDto> {
    return this.bookingService.findById(id);
  }

  @Post(':id/confirm-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Staff')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Staff/Admin: confirm payment for a Draft booking with a slip upload' })
  @ApiResponse({ status: 200, type: ConfirmPaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({ status: 409, description: 'Booking is not in Draft status' })
  @ApiResponse({ status: 400, description: 'Bad file type, oversized file, or missing note' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_HARD_CAP_BYTES },
    }),
  )
  async confirmPayment(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ConfirmPaymentDto,
    @Req() req: RequestWithUser,
  ): Promise<ConfirmPaymentResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.bookingService.confirmPayment(
      id,
      { buffer: file.buffer, size: file.size },
      dto,
      req.user.sub,
    );
  }

  @Get(':id/slip')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Staff')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff/Admin: stream the uploaded payment slip image' })
  @ApiResponse({ status: 404, description: 'Booking not found or no slip uploaded' })
  async getSlip(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mimeType } = await this.bookingService.getSlipStream(id);
    res.set({ 'Content-Type': mimeType });
    return new StreamableFile(stream);
  }
}
