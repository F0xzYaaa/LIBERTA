import { describe, expect, it } from 'vitest';
import { getBookingStatusTone } from './bookingStatusBadge';
import { BookingStatus } from '../api/types/booking.types';

// NOTE: this lib helper is consumed exclusively by admin pages (BookingsPage,
// BookingDetailPage, DashboardPage) which landed on disk during this test
// session but are explicitly OUT OF SCOPE for this test pass per instructions
// (part 3/4, untested). This is a narrow spot-check of the pure mapping
// function only -- it does not constitute admin-page test coverage.
describe('getBookingStatusTone', () => {
  it.each([
    [BookingStatus.Draft, 'neutral'],
    [BookingStatus.Reserved, 'success'],
    [BookingStatus.CheckedIn, 'info'],
    [BookingStatus.CheckedOut, 'neutral'],
    [BookingStatus.Cancelled, 'danger'],
    [BookingStatus.NoShow, 'danger'],
    [BookingStatus.Expired, 'warning'],
  ])('maps %s -> %s', (status, expectedTone) => {
    expect(getBookingStatusTone(status)).toBe(expectedTone);
  });

  it('falls back to "neutral" for an unrecognized status value', () => {
    expect(getBookingStatusTone('SomeUnknownStatus' as BookingStatus)).toBe('neutral');
  });
});
