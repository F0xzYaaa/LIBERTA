import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from './HomePage';
import * as roomApi from '../../api/room.api';
import type { RoomType } from '../../api/types/room.types';

vi.mock('../../api/room.api');

const ROOM_TYPES: RoomType[] = [
  {
    roomTypeId: 1,
    typeName: 'Garden View',
    pricePerNight: 1500,
    capacity: 2,
    description: 'A quiet garden room',
    packageDetails: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  it('renders featured room types once loaded', async () => {
    vi.mocked(roomApi.findAllRoomTypes).mockResolvedValue(ROOM_TYPES);
    renderPage();

    await waitFor(() => expect(screen.getByText('Garden View')).toBeInTheDocument());
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
  });

  it('shows an error message if room types fail to load', async () => {
    vi.mocked(roomApi.findAllRoomTypes).mockRejectedValue(new Error('network down'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('shows an empty-state message when there are no room types', async () => {
    vi.mocked(roomApi.findAllRoomTypes).mockResolvedValue([]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Room types will be available here soon.')).toBeInTheDocument(),
    );
  });
});
