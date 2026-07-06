import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityLogger } from '../common/security-logger.service';
import { GuestResponseDto } from './dto/guest-response.dto';
import { LookupGuestDto } from './dto/lookup-guest.dto';
import { RegisterGuestDto } from './dto/register-guest.dto';
import { Guest } from './entities/guest.entity';

@Injectable()
export class GuestService {
  constructor(
    @InjectRepository(Guest) private readonly guestRepo: Repository<Guest>,
    private readonly securityLogger: SecurityLogger,
  ) {}

  async register(dto: RegisterGuestDto): Promise<GuestResponseDto> {
    if (dto.idCard) {
      const existing = await this.guestRepo.findOne({ where: { idCard: dto.idCard } });
      if (existing) {
        throw new ConflictException('This ID card is already registered to another guest');
      }
    }

    const guest = this.guestRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email ?? null,
      idCard: dto.idCard ?? null,
      nationality: dto.nationality ?? 'Thai',
    });
    const saved = await this.guestRepo.save(guest);

    this.securityLogger.log('guest_registered', { guestId: saved.guestId });

    return this.toResponseDto(saved);
  }

  /**
   * Two-factor lookup (guestId + phone/email match), mirroring booking-service's
   * lookup pattern — closes the enumeration hole a plain GET /guests/:id would have,
   * since guestId is a sequential auto-increment.
   */
  async lookup(dto: LookupGuestDto): Promise<GuestResponseDto> {
    const guest = await this.guestRepo.findOne({ where: { guestId: dto.guestId } });
    const contactMatches = guest && (guest.phone === dto.contact || guest.email === dto.contact);

    if (!guest || !contactMatches) {
      throw new NotFoundException('Guest not found');
    }
    return this.toResponseDto(guest);
  }

  private toResponseDto(guest: Guest): GuestResponseDto {
    return {
      guestId: guest.guestId,
      firstName: guest.firstName,
      lastName: guest.lastName,
      phone: guest.phone,
      email: guest.email,
      loyaltyPoints: guest.loyaltyPoints,
    };
  }
}
