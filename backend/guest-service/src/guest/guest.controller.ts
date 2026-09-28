import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GuestResponseDto } from './dto/guest-response.dto';
import { LookupGuestDto } from './dto/lookup-guest.dto';
import { RegisterGuestDto } from './dto/register-guest.dto';
import { GuestService } from './guest.service';

@ApiTags('guests')
@Controller('guests')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Light guest registration — name/email/phone only, no password' })
  @ApiResponse({ status: 201, type: GuestResponseDto })
  @ApiResponse({ status: 409, description: 'ID card already registered to another guest' })
  async register(@Body() dto: RegisterGuestDto): Promise<GuestResponseDto> {
    return this.guestService.register(dto);
  }

  @Post('lookup')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Two-factor lookup: guestId + phone/email must both match' })
  @ApiResponse({ status: 200, type: GuestResponseDto })
  @ApiResponse({ status: 404, description: 'No match for the guestId + contact combination' })
  async lookup(@Body() dto: LookupGuestDto): Promise<GuestResponseDto> {
    return this.guestService.lookup(dto);
  }
}
