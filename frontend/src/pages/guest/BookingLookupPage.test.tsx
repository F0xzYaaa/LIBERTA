import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { BookingLookupPage } from './BookingLookupPage';
import * as bookingApi from '../../api/booking.api';
import type { LookupBookingResponse } from '../../api/types/booking.types';

vi.mock('../../api/booking.api');

function makeAxiosError(status: number): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: {},
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingLookupPage />
    </QueryClientProvider>,
  );
}

describe('BookingLookupPage', () => {
  it('shows a generic "no booking found" message on 404, without hinting which field was wrong', async () => {
    vi.mocked(bookingApi.lookup).mockRejectedValue(makeAxiosError(404));
    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Booking reference'), 'BK-2026-000001');
    await user.type(screen.getByLabelText('Phone or email'), '0800000000');
    await user.click(screen.getByRole('button', { name: /find booking/i }));

    await waitFor(() =>
      expect(
        screen.getByText('No booking found — check your reference and contact info.'),
      ).toBeInTheDocument(),
    );
  });

  it('renders booking details on a successful lookup', async () => {
    const response: LookupBookingResponse = {
      reference: 'BK-2026-000001',
      status: 'Reserved',
      checkIn: '2026-08-15',
      checkOut: '2026-08-17',
      roomNumber: '101',
      roomType: 'Sea View Suite',
      totalPrice: 4000,
    };
    vi.mocked(bookingApi.lookup).mockResolvedValue(response);
    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Booking reference'), 'BK-2026-000001');
    await user.type(screen.getByLabelText('Phone or email'), '0800000000');
    await user.click(screen.getByRole('button', { name: /find booking/i }));

    await waitFor(() => expect(screen.getAllByText('BK-2026-000001').length).toBeGreaterThan(0));
    expect(screen.getByText('Reserved')).toBeInTheDocument();
    expect(screen.getByText('Sea View Suite')).toBeInTheDocument();
  });
});
