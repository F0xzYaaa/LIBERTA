import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { TokenResponseDto } from './dto/token-response.dto';

/**
 * Calls auth-service's internal-only issue-token endpoint after this service
 * has independently verified TOTP/backup code — auth-service remains the
 * single JWT-signing authority (architect decision, 2026-07-06).
 */
@Injectable()
export class AuthClientService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async issueTokenForEmployee(employeeId: number): Promise<TokenResponseDto> {
    const baseUrl = this.config.get<string>('AUTH_SERVICE_URL');
    const internalKey = this.config.get<string>('INTERNAL_SERVICE_KEY');

    try {
      const response = await firstValueFrom(
        this.http.post<TokenResponseDto>(
          `${baseUrl}/auth/internal/issue-token`,
          { employeeId },
          { headers: { 'x-internal-key': internalKey } },
        ),
      );
      return response.data;
    } catch {
      throw new InternalServerErrorException('Failed to issue token via auth-service');
    }
  }
}
