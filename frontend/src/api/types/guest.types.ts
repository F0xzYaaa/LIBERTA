// Mirrors backend/guest-service/src/guest/dto/*.ts

export interface RegisterGuestRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  idCard?: string;
  nationality?: string;
}

export interface LookupGuestRequest {
  guestId: number;
  /** Guest's phone or email, either matches */
  contact: string;
}

export interface GuestResponse {
  guestId: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  loyaltyPoints: number;
}
