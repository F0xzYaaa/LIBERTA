// Mirrors services/mfa-service/src/mfa/dto/*.ts
import type { TokenResponse } from './auth.types';

export interface GenerateMfaRequest {
  tempToken: string;
}

export interface GenerateMfaResponse {
  /** data: URI PNG QR code — scan with an authenticator app */
  qrCodeDataUri: string;
  /** Base32 secret for manual entry if the QR code cannot be scanned */
  manualEntryKey: string;
  /** 10 one-time backup codes, shown exactly once — store them safely */
  backupCodes: string[];
}

export interface AdminResetMfaRequest {
  employeeId: number;
}

export interface VerifyMfaRequest {
  tempToken: string;
  totpCode: string;
}

export interface VerifyBackupCodeRequest {
  tempToken: string;
  backupCode: string;
}

/** mfa-service relays auth-service's TokenResponseDto unchanged. */
export type MfaTokenResponse = TokenResponse;
