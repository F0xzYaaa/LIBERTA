import { apiClient } from './client';
import type { TokenResponse } from './types/auth.types';
import type {
  AdminResetMfaRequest,
  GenerateMfaResponse,
  VerifyBackupCodeRequest,
  VerifyMfaRequest,
} from './types/mfa.types';

/** Self-enrollment: generate a TOTP secret + backup codes using a tempToken. */
export async function generate(tempToken: string): Promise<GenerateMfaResponse> {
  const { data } = await apiClient.post<GenerateMfaResponse>('/mfa/generate', { tempToken });
  return data;
}

/** Admin-only: wipe and regenerate MFA enrollment for another employee. */
export async function adminReset(payload: AdminResetMfaRequest): Promise<GenerateMfaResponse> {
  const { data } = await apiClient.post<GenerateMfaResponse>('/mfa/admin-reset', payload);
  return data;
}

/** Step 2 of staff/admin login: verify a TOTP code, receive JWT tokens. */
export async function verify(payload: VerifyMfaRequest): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/mfa/verify', payload);
  return data;
}

/** Alternative to TOTP: verify a one-time backup code. */
export async function verifyBackupCode(payload: VerifyBackupCodeRequest): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/mfa/backup-code/verify', payload);
  return data;
}
