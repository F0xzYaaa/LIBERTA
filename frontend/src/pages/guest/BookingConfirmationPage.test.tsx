import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BookingConfirmationPage } from './BookingConfirmationPage';

function renderAt(path: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/booking/:id/confirmation" element={<BookingConfirmationPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BookingConfirmationPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a friendly fallback (no crash) when there is no router state, e.g. a direct page load/refresh', () => {
    renderAt('/booking/999/confirmation', undefined);

    expect(screen.getByText("We couldn't find that booking here")).toBeInTheDocument();
    expect(screen.getByText('Find My Booking').closest('a')).toHaveAttribute(
      'href',
      '/booking/lookup',
    );
    // Must not render any confirmation details that would rely on undefined state.
    expect(screen.queryByText('Booking Reference')).not.toBeInTheDocument();
  });

  it('renders a friendly fallback when router state is present but malformed (missing fields)', () => {
    renderAt('/booking/999/confirmation', {
      reference: 'BK-2026-000999' /* missing other fields */,
    });

    expect(screen.getByText("We couldn't find that booking here")).toBeInTheDocument();
  });

  it('renders full confirmation details when valid router state is present', () => {
    renderAt('/booking/999/confirmation', {
      reference: 'BK-2026-000999',
      lockExpiresAt: '2026-08-15T12:15:00.000Z',
      totalPrice: 4000,
    });

    expect(screen.getByText('BK-2026-000999')).toBeInTheDocument();
    expect(screen.getByText(/4,000/)).toBeInTheDocument();
    expect(screen.getByText('15:00')).toBeInTheDocument(); // 15 min countdown at t=0
  });

  it('shows "Expired" once the lock time has passed', () => {
    renderAt('/booking/999/confirmation', {
      reference: 'BK-2026-000999',
      lockExpiresAt: '2026-08-15T11:59:00.000Z', // already in the past
      totalPrice: 4000,
    });

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});
