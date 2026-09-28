import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const presented = request.header('x-internal-key') ?? '';
    const expected = this.config.get<string>('INTERNAL_SERVICE_KEY') ?? '';

    const presentedBuf = Buffer.from(presented);
    const expectedBuf = Buffer.from(expected);
    const valid =
      presentedBuf.length === expectedBuf.length &&
      presentedBuf.length > 0 &&
      timingSafeEqual(presentedBuf, expectedBuf);

    if (!valid) {
      throw new UnauthorizedException('Invalid internal service key');
    }
    return true;
  }
}
