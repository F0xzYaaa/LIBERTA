import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SecurityLogger {
  private readonly logger = new Logger('SecurityEvent');

  log(event: string, details: Record<string, unknown> = {}): void {
    this.logger.log(JSON.stringify({ event, ...details, timestamp: new Date().toISOString() }));
  }

  warn(event: string, details: Record<string, unknown> = {}): void {
    this.logger.warn(JSON.stringify({ event, ...details, timestamp: new Date().toISOString() }));
  }
}
