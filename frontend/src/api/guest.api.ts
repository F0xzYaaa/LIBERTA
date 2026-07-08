import { apiClient } from './client';
import type { GuestResponse, LookupGuestRequest, RegisterGuestRequest } from './types/guest.types';

/** Light guest registration — name/email/phone only, no password. */
export async function register(payload: RegisterGuestRequest): Promise<GuestResponse> {
  const { data } = await apiClient.post<GuestResponse>('/guests/register', payload);
  return data;
}

/** Two-factor lookup: guestId + phone/email must both match. */
export async function lookup(payload: LookupGuestRequest): Promise<GuestResponse> {
  const { data } = await apiClient.post<GuestResponse>('/guests/lookup', payload);
  return data;
}
