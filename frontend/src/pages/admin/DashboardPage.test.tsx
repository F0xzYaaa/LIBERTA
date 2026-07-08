import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './DashboardPage';
import * as adminApi from '../../api/admin.api';
import { dashboardRequestQueue } from '../../lib/requestQueue';
import { RevenueGroupBy } from '../../api/types/admin.types';
import type {
  BookingsByStatusResponse,
  DashboardSummaryResponse,
  OccupancyResponse,
  RevenueResponse,
} from '../../api/types/admin.types';

vi.mock('../../api/admin.api');

const SUMMARY: DashboardSummaryResponse = {
  arrivalsToday: 3,
  departuresToday: 2,
  pendingPaymentConfirmations: 1,
  occupiedRoomsToday: 10,
  totalActiveRooms: 20,
  occupancyRatePercent: 50,
  revenueTodayConfirmed: 12000,
};

const OCCUPANCY: OccupancyResponse = {
  from: '2026-06-08',
  to: '2026-07-07',
  days: [{ date: '2026-07-01', occupiedRooms: 10, totalActiveRooms: 20, occupancyRatePercent: 50 }],
};

const REVENUE: RevenueResponse = {
  from: '2026-06-08',
  to: '2026-07-07',
  groupBy: RevenueGroupBy.Day,
  buckets: [{ period: '2026-07-01', revenue: 12000 }],
};

const BOOKINGS_BY_STATUS: BookingsByStatusResponse = {
  Draft: 1,
  Reserved: 2,
  CheckedIn: 3,
  CheckedOut: 4,
  Cancelled: 0,
  NoShow: 0,
  Expired: 0,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    'sequences all 4 admin-service calls through dashboardRequestQueue with real >=550ms gaps ' +
      'between each start -- NEVER firing them simultaneously via Promise.all (regression guard ' +
      'for the Stage 4 Nginx 503s)',
    async () => {
      const scheduleSpy = vi.spyOn(dashboardRequestQueue, 'schedule');
      const startTimes: number[] = [];

      function trackedResolve<T>(value: T): () => Promise<T> {
        return () => {
          startTimes.push(Date.now());
          return Promise.resolve(value);
        };
      }

      vi.mocked(adminApi.getSummary).mockImplementation(trackedResolve(SUMMARY));
      vi.mocked(adminApi.getOccupancy).mockImplementation(trackedResolve(OCCUPANCY));
      vi.mocked(adminApi.getRevenue).mockImplementation(trackedResolve(REVENUE));
      vi.mocked(adminApi.getBookingsByStatus).mockImplementation(
        trackedResolve(BOOKINGS_BY_STATUS),
      );

      renderPage();

      // The 4th (last) call cannot start before 3 * 600ms have elapsed since
      // the first -- give real-timer generous headroom above the 15s test
      // timeout ceiling isn't needed, but the wait itself must be patient.
      await waitFor(() => expect(startTimes).toHaveLength(4), { timeout: 10000 });

      // Every admin-service call in this component must be routed through the
      // shared queue -- never called directly / via Promise.all.
      expect(scheduleSpy).toHaveBeenCalledTimes(4);

      const sorted = [...startTimes].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - sorted[i - 1];
        expect(gap).toBeGreaterThanOrEqual(550); // 600ms nominal, small slack for timer jitter
      }

      // Sanity check against the "fired simultaneously" failure mode directly:
      // total spread across all 4 starts must reflect 3 real gaps, not ~0ms.
      expect(sorted[3] - sorted[0]).toBeGreaterThanOrEqual(1650);

      await waitFor(() => expect(screen.getByText('Arrivals Today')).toBeInTheDocument());
      // "3" alone is ambiguous (also matches the CheckedIn count below), so
      // scope the assertion to the Arrivals Today stat card specifically.
      const arrivalsCard = screen.getByText('Arrivals Today').closest('div');
      expect(arrivalsCard).not.toBeNull();
      expect(within(arrivalsCard as HTMLElement).getByText('3')).toBeInTheDocument();
      expect(screen.getByText('฿12,000')).toBeInTheDocument(); // revenueTodayConfirmed
    },
    15000,
  );

  it('shows loading spinners immediately for all sections before any queued call resolves', () => {
    vi.mocked(adminApi.getSummary).mockReturnValue(new Promise(() => undefined));
    vi.mocked(adminApi.getOccupancy).mockReturnValue(new Promise(() => undefined));
    vi.mocked(adminApi.getRevenue).mockReturnValue(new Promise(() => undefined));
    vi.mocked(adminApi.getBookingsByStatus).mockReturnValue(new Promise(() => undefined));

    renderPage();

    expect(screen.getByText('Occupancy Rate')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Bookings by Status')).toBeInTheDocument();
    expect(screen.queryByText('Arrivals Today')).not.toBeInTheDocument();
  });
});
