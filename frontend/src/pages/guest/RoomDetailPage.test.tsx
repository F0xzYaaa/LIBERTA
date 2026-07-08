import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoomDetailPage } from './RoomDetailPage';
import * as roomApi from '../../api/room.api';
import type { RoomType } from '../../api/types/room.types';

vi.mock('../../api/room.api');

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/rooms/:id" element={<RoomDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RoomDetailPage', () => {
  it('shows "could not be found" without calling the API for a non-numeric id', () => {
    renderAt('/rooms/not-a-number');
    expect(screen.getByText('This room type could not be found.')).toBeInTheDocument();
    expect(roomApi.findRoomTypeById).not.toHaveBeenCalled();
  });

  it('renders room type details including packageDetails once loaded', async () => {
    const roomType: RoomType = {
      roomTypeId: 3,
      typeName: 'Hillside Retreat',
      pricePerNight: 1800,
      capacity: 3,
      description: 'Quiet hillside room',
      packageDetails: { breakfastIncluded: true, freeWifi: true },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(roomApi.findRoomTypeById).mockResolvedValue(roomType);

    renderAt('/rooms/3');

    await waitFor(() => expect(screen.getByText('Hillside Retreat')).toBeInTheDocument());
    expect(screen.getByText('Breakfast Included')).toBeInTheDocument();
    expect(roomApi.findRoomTypeById).toHaveBeenCalledWith(3);
  });

  it('renders a "no additional details" fallback when packageDetails is null', async () => {
    vi.mocked(roomApi.findRoomTypeById).mockResolvedValue({
      roomTypeId: 4,
      typeName: 'Basic Room',
      pricePerNight: 900,
      capacity: 1,
      description: null,
      packageDetails: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderAt('/rooms/4');

    await waitFor(() =>
      expect(screen.getByText('No additional details for this room type.')).toBeInTheDocument(),
    );
  });
});
