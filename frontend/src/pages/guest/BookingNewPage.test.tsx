import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingNewPage } from './BookingNewPage';
import { ToastProvider } from '../../components/ui';
import { setStoredGuestId } from '../../lib/guestStore';
import * as bookingApi from '../../api/booking.api';
import * as roomApi from '../../api/room.api';
import { AxiosError, AxiosHeaders } from 'axios';
import type { RoomType } from '../../api/types/room.types';
import type { AvailableRoomResponse, CreateDraftResponse } from '../../api/types/booking.types';

vi.mock('../../api/booking.api');
vi.mock('../../api/room.api');
vi.mock('../../api/guest.api');

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function makeAxiosError(status: number): AxiosError {
  return new AxiosError(`status ${status}`, String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { message: `error ${status}` },
  });
}

const ROOM_TYPE: RoomType = {
  roomTypeId: 7,
  typeName: 'Sea View Suite',
  pricePerNight: 2000,
  capacity: 4,
  description: null,
  packageDetails: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const AVAILABLE_ROOM: AvailableRoomResponse = {
  roomId: 101,
  roomNumber: '101',
  roomTypeId: 7,
  typeName: 'Sea View Suite',
  pricePerNight: 2000,
  capacity: 4,
  nights: 2,
  totalPrice: 4000,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/booking/new/7']}>
          <Routes>
            <Route path="/booking/new/:roomTypeId" element={<BookingNewPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function fillAndSubmitBookingForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Check-in'), '2026-08-15');
  await user.type(screen.getByLabelText('Check-out'), '2026-08-17');
  await user.click(screen.getByRole('button', { name: /request booking/i }));
  return user;
}

describe('BookingNewPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setStoredGuestId(55); // skip the guest-details step, land directly on "Your Stay"
    vi.mocked(roomApi.findRoomTypeById).mockResolvedValue(ROOM_TYPE);
    navigateMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('short-circuits on a 404 from available-room ("fully booked") without ever calling createDraft', async () => {
    vi.mocked(bookingApi.findAvailableRoom).mockRejectedValue(makeAxiosError(404));
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Check-in')).toBeInTheDocument());
    await fillAndSubmitBookingForm();

    await waitFor(() =>
      expect(
        screen.getByText('Fully booked for these dates — please try different dates.'),
      ).toBeInTheDocument(),
    );
    expect(bookingApi.createDraft).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('retries once on a 409 (room locked), succeeding on the second attempt', async () => {
    vi.mocked(bookingApi.findAvailableRoom).mockResolvedValue(AVAILABLE_ROOM);
    const draftResponse: CreateDraftResponse = {
      bookingId: 999,
      reference: 'BK-2026-000999',
      lockExpiresAt: '2026-08-15T12:15:00.000Z',
      totalPrice: 4000,
    };
    vi.mocked(bookingApi.createDraft)
      .mockRejectedValueOnce(makeAxiosError(409))
      .mockResolvedValueOnce(draftResponse);

    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Check-in')).toBeInTheDocument());
    await fillAndSubmitBookingForm();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
    expect(bookingApi.findAvailableRoom).toHaveBeenCalledTimes(2);
    expect(bookingApi.createDraft).toHaveBeenCalledTimes(2);
    expect(navigateMock).toHaveBeenCalledWith(
      '/booking/999/confirmation',
      expect.objectContaining({
        state: {
          reference: 'BK-2026-000999',
          lockExpiresAt: '2026-08-15T12:15:00.000Z',
          totalPrice: 4000,
        },
      }),
    );
  });

  it('shows "please try again" and STOPS after a second consecutive 409 -- never a third attempt', async () => {
    vi.mocked(bookingApi.findAvailableRoom).mockResolvedValue(AVAILABLE_ROOM);
    vi.mocked(bookingApi.createDraft).mockRejectedValue(makeAxiosError(409));

    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Check-in')).toBeInTheDocument());
    await fillAndSubmitBookingForm();

    await waitFor(() =>
      expect(screen.getByText('Please try again in a moment.')).toBeInTheDocument(),
    );

    // Bounded: exactly 2 attempts, never more, no infinite retry loop.
    expect(bookingApi.createDraft).toHaveBeenCalledTimes(2);
    expect(bookingApi.findAvailableRoom).toHaveBeenCalledTimes(2);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('blocks submission client-side when check-out is not after check-in (no API calls at all)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Check-in')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Check-in'), '2026-08-17');
    await user.type(screen.getByLabelText('Check-out'), '2026-08-15');
    await user.click(screen.getByRole('button', { name: /request booking/i }));

    await waitFor(() =>
      expect(screen.getByText('Check-out date must be after check-in date.')).toBeInTheDocument(),
    );
    expect(bookingApi.findAvailableRoom).not.toHaveBeenCalled();
    expect(bookingApi.createDraft).not.toHaveBeenCalled();
  });

  it('shows "Invalid room type" and never queries when :roomTypeId is not numeric', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/booking/new/not-a-number']}>
            <Routes>
              <Route path="/booking/new/:roomTypeId" element={<BookingNewPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Invalid room type.')).toBeInTheDocument();
    expect(roomApi.findRoomTypeById).not.toHaveBeenCalled();
  });
});
