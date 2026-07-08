// Mirrors services/booking-service/src/booking/dto/*.ts and entities/booking.entity.ts

export enum BookingStatus {
  Draft = 'Draft',
  Reserved = 'Reserved',
  CheckedIn = 'CheckedIn',
  CheckedOut = 'CheckedOut',
  Cancelled = 'Cancelled',
  NoShow = 'NoShow',
  Expired = 'Expired',
}

export interface CreateDraftBookingRequest {
  guestId: number;
  roomId: number;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  specialRequest?: string;
}

export interface CreateDraftResponse {
  bookingId: number;
  /** e.g. "BK-2026-000042" */
  reference: string;
  lockExpiresAt: string;
  totalPrice: number;
}

export interface LookupBookingRequest {
  reference: string;
  /** Guest's phone or email, either matches */
  contact: string;
}

/** Deliberately limited — no guestId, no internal booking_id, no other guest's data. */
export interface LookupBookingResponse {
  reference: string;
  status: string;
  checkIn: string;
  checkOut: string;
  roomNumber: string;
  roomType: string;
  totalPrice: number;
}

export interface FindAvailableRoomParams {
  roomTypeId: number;
  checkIn: string;
  checkOut: string;
  numGuests?: number;
}

export interface AvailableRoomResponse {
  roomId: number;
  roomNumber: string;
  roomTypeId: number;
  typeName: string;
  pricePerNight: number;
  capacity: number;
  nights: number;
  totalPrice: number;
}

export interface FindAllBookingsParams {
  status?: BookingStatus;
  checkInFrom?: string;
  checkInTo?: string;
  roomId?: number;
}

export interface BookingGuestSummary {
  guestId: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
}

export interface BookingRoomTypeSummary {
  roomTypeId: number;
  typeName: string;
  pricePerNight: number;
}

export interface BookingRoomSummary {
  roomId: number;
  roomNumber: string;
  roomType: BookingRoomTypeSummary;
}

// Staff/Admin booking detail shape. Never includes slipImagePath (the raw
// filesystem path) — only a derived hasSlip boolean. The slip itself is only
// ever readable through the authenticated GET /bookings/:id/slip endpoint.
export interface BookingResponse {
  bookingId: number;
  guest: BookingGuestSummary;
  room: BookingRoomSummary;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  totalPrice: number;
  status: BookingStatus;
  lockExpiresAt: string | null;
  paymentNote: string | null;
  hasSlip: boolean;
  paymentConfirmedBy: number | null;
  paymentConfirmedAt: string | null;
  specialRequest: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmPaymentRequest {
  /** Staff note on payment verification, e.g. "PromptPay 08/07 14:32" */
  paymentNote: string;
}

export interface ConfirmPaymentResponse {
  bookingId: number;
  status: BookingStatus;
  paymentConfirmedAt: string;
  paymentConfirmedBy: number;
  hasSlip: boolean;
}
