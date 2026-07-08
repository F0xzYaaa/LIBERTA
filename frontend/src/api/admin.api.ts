import { apiClient } from './client';
import type {
  BookingsByStatusResponse,
  DashboardSummaryResponse,
  OccupancyQueryParams,
  OccupancyResponse,
  RevenueQueryParams,
  RevenueResponse,
} from './types/admin.types';

/** Staff/Admin: today's key operational metrics (Redis-cached 60s server-side). */
export async function getSummary(): Promise<DashboardSummaryResponse> {
  const { data } = await apiClient.get<DashboardSummaryResponse>('/admin/dashboard/summary');
  return data;
}

/** Staff/Admin: daily occupancy rate over a date range. */
export async function getOccupancy(params: OccupancyQueryParams): Promise<OccupancyResponse> {
  const { data } = await apiClient.get<OccupancyResponse>('/admin/dashboard/occupancy', {
    params,
  });
  return data;
}

/** Staff/Admin: confirmed revenue grouped by day or month (source: paymentConfirmedAt). */
export async function getRevenue(params: RevenueQueryParams): Promise<RevenueResponse> {
  const { data } = await apiClient.get<RevenueResponse>('/admin/dashboard/revenue', { params });
  return data;
}

/** Staff/Admin: booking counts grouped by status. */
export async function getBookingsByStatus(): Promise<BookingsByStatusResponse> {
  const { data } = await apiClient.get<BookingsByStatusResponse>(
    '/admin/dashboard/bookings-by-status',
  );
  return data;
}
