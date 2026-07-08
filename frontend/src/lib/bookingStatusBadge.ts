// Shared status -> Badge tone mapping for admin booking views (list, detail,
// dashboard breakdown) so the three pages that render a BookingStatus badge
// don't each re-invent their own color mapping.

import type { BadgeTone } from '../components/ui';
import { BookingStatus } from '../api/types/booking.types';

const BOOKING_STATUS_TONE: Record<BookingStatus, BadgeTone> = {
  [BookingStatus.Draft]: 'neutral',
  [BookingStatus.Reserved]: 'success',
  [BookingStatus.CheckedIn]: 'info',
  [BookingStatus.CheckedOut]: 'neutral',
  [BookingStatus.Cancelled]: 'danger',
  [BookingStatus.NoShow]: 'danger',
  [BookingStatus.Expired]: 'warning',
};

export function getBookingStatusTone(status: BookingStatus): BadgeTone {
  return BOOKING_STATUS_TONE[status] ?? 'neutral';
}
