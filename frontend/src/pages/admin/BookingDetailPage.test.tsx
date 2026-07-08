import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../components/ui';
import { BookingDetailPage } from './BookingDetailPage';
import * as bookingApi from '../../api/booking.api';
import { BookingStatus } from '../../api/types/booking.types';
import type { BookingResponse } from '../../api/types/booking.types';

vi.mock('../../api/booking.api');

const BOOKING_WITH_SLIP: BookingResponse = {
  bookingId: 42,
  guest: { guestId: 7, firstName: 'Somchai', lastName: 'Jaidee', phone: '0812345678', email: null },
  room: {
    roomId: 3,
    roomNumber: '203',
    roomType: { roomTypeId: 1, typeName: 'Deluxe', pricePerNight: 3000 },
  },
  checkIn: '2026-08-15',
  checkOut: '2026-08-17',
  numGuests: 2,
  totalPrice: 6000,
  status: BookingStatus.Reserved,
  lockExpiresAt: null,
  paymentNote: 'PromptPay 08/07 14:32',
  hasSlip: true,
  paymentConfirmedBy: 1,
  paymentConfirmedAt: '2026-07-08T10:00:00.000Z',
  specialRequest: null,
  createdBy: 1,
  createdAt: '2026-07-08T09:00:00.000Z',
  updatedAt: '2026-07-08T10:00:00.000Z',
};

function renderPage(bookingId = 42) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/admin/bookings/${bookingId}`]}>
          <Routes>
            <Route path="/admin/bookings/:id" element={<BookingDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('BookingDetailPage / SlipViewer', () => {
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    createObjectURL.mockReturnValue('blob:http://localhost/fake-object-url-42');
    // Patch the methods directly onto the real global URL (rather than
    // vi.stubGlobal-replacing the whole URL object) so that RTL's own
    // afterEach(cleanup()) -- which unmounts the tree and runs SlipViewer's
    // effect-cleanup (URL.revokeObjectURL) -- still sees a working stub, no
    // matter which afterEach hook happens to run first.
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it('fetches the slip via the authenticated blob endpoint (bookingApi.getSlip), never a plain <img src> to the raw REST path', async () => {
    vi.mocked(bookingApi.findById).mockResolvedValue(BOOKING_WITH_SLIP);
    const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/png' });
    vi.mocked(bookingApi.getSlip).mockResolvedValue(fakeBlob);

    renderPage();

    await waitFor(() => expect(bookingApi.getSlip).toHaveBeenCalledWith(42));

    const img = await screen.findByAltText('Uploaded payment slip');
    // The rendered <img> src must be the blob object URL created from the
    // authenticated fetch response -- NEVER a direct path to the JWT-protected
    // REST endpoint (a plain <img src="/api/bookings/42/slip"> cannot attach
    // an Authorization header and would 401).
    expect(img).toHaveAttribute('src', 'blob:http://localhost/fake-object-url-42');
    expect(img.getAttribute('src')).not.toContain('/api/bookings/42/slip');
    expect(img.getAttribute('src')).not.toContain('/bookings/42/slip');
    expect(createObjectURL).toHaveBeenCalledWith(fakeBlob);
  });

  it('shows a loading spinner while the slip blob fetch is in flight, then the image once resolved', async () => {
    vi.mocked(bookingApi.findById).mockResolvedValue(BOOKING_WITH_SLIP);
    let resolveSlip: (blob: Blob) => void = () => undefined;
    vi.mocked(bookingApi.getSlip).mockReturnValue(
      new Promise((resolve) => {
        resolveSlip = resolve;
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText('Payment Slip')).toBeInTheDocument());
    expect(screen.queryByAltText('Uploaded payment slip')).not.toBeInTheDocument();

    resolveSlip(new Blob(['x'], { type: 'image/png' }));
    await waitFor(() => expect(screen.getByAltText('Uploaded payment slip')).toBeInTheDocument());
  });

  it('shows an error message (not a broken image) if the authenticated slip fetch fails', async () => {
    vi.mocked(bookingApi.findById).mockResolvedValue(BOOKING_WITH_SLIP);
    // A plain Error with a message is surfaced verbatim by getErrorMessage()
    // (it only falls back to the generic message when there's no `.message`
    // at all, e.g. an AxiosError response body with no `message` field) --
    // mirror that contract here rather than assert the fallback text.
    vi.mocked(bookingApi.getSlip).mockRejectedValue(new Error('403 forbidden -- not authorized'));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('403 forbidden -- not authorized')).toBeInTheDocument(),
    );
    expect(screen.queryByAltText('Uploaded payment slip')).not.toBeInTheDocument();
  });

  it('does not render SlipViewer at all when the booking has no slip uploaded', async () => {
    vi.mocked(bookingApi.findById).mockResolvedValue({ ...BOOKING_WITH_SLIP, hasSlip: false });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Somchai Jaidee/)).toBeInTheDocument());
    expect(screen.queryByText('Payment Slip')).not.toBeInTheDocument();
    expect(bookingApi.getSlip).not.toHaveBeenCalled();
  });

  it('revokes the object URL on unmount to avoid leaking memory', async () => {
    vi.mocked(bookingApi.findById).mockResolvedValue(BOOKING_WITH_SLIP);
    vi.mocked(bookingApi.getSlip).mockResolvedValue(new Blob(['x'], { type: 'image/png' }));

    const { unmount } = renderPage();
    await screen.findByAltText('Uploaded payment slip');

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake-object-url-42');
  });
});
