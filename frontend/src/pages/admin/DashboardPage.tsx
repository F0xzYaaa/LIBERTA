import { useMemo } from 'react';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as adminApi from '../../api/admin.api';
import {
  BookingsByStatusResponse,
  DashboardSummaryResponse,
  OccupancyResponse,
  RevenueGroupBy,
  RevenueResponse,
} from '../../api/types/admin.types';
import { BookingStatus } from '../../api/types/booking.types';
import { Badge, Card, ErrorMessage, LoadingSpinner } from '../../components/ui';
import { dashboardRequestQueue } from '../../lib/requestQueue';
import { getBookingStatusTone } from '../../lib/bookingStatusBadge';
import { getErrorMessage } from '../../lib/apiError';
import { formatCurrency, formatDate } from '../../lib/format';

// Default range for the occupancy/revenue charts: the last 30 days, ending
// today. A date-range picker is a nice-to-have follow-up, not required for
// v1 -- every admin lands on the same fixed window for now.
const DASHBOARD_RANGE_DAYS = 30;

/** YYYY-MM-DD, suitable for the admin-service's `from`/`to` query params. */
function toIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function useDashboardDateRange(): { from: string; to: string } {
  return useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (DASHBOARD_RANGE_DAYS - 1));
    return { from: toIsoDateString(from), to: toIsoDateString(to) };
  }, []);
}

export function DashboardPage(): JSX.Element {
  const { from, to } = useDashboardDateRange();

  // IMPORTANT: these four admin-service calls are deliberately sequenced
  // through `dashboardRequestQueue` (600ms min gap, FIFO) instead of firing
  // in parallel via Promise.all. Firing them in parallel caused real 503s
  // against Nginx's general_limit rate zone during Stage 4 testing when a
  // user rapidly re-focused this tab. Each queryFn below schedules its axios
  // call through the shared queue, so at most one of these requests is ever
  // in flight at a time, regardless of how React Query itself schedules the
  // four useQuery hooks.
  const summaryQuery = useQuery({
    queryKey: ['admin-dashboard', 'summary'],
    queryFn: () => dashboardRequestQueue.schedule(() => adminApi.getSummary()),
  });

  const occupancyQuery = useQuery({
    queryKey: ['admin-dashboard', 'occupancy', from, to],
    queryFn: () => dashboardRequestQueue.schedule(() => adminApi.getOccupancy({ from, to })),
  });

  const revenueQuery = useQuery({
    queryKey: ['admin-dashboard', 'revenue', from, to],
    queryFn: () =>
      dashboardRequestQueue.schedule(() =>
        adminApi.getRevenue({ from, to, groupBy: RevenueGroupBy.Day }),
      ),
  });

  const bookingsByStatusQuery = useQuery({
    queryKey: ['admin-dashboard', 'bookings-by-status'],
    queryFn: () => dashboardRequestQueue.schedule(() => adminApi.getBookingsByStatus()),
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-primary-dark">Dashboard</h1>
        <p className="mt-1 font-sans text-sm text-sage-gray">
          Occupancy and revenue trends for {formatDate(from)} – {formatDate(to)}.
        </p>
      </div>

      <SummarySection query={summaryQuery} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OccupancyChart query={occupancyQuery} />
        <RevenueChart query={revenueQuery} />
      </div>

      <BookingsByStatusSection query={bookingsByStatusQuery} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Card>
      <p className="font-sans text-sm text-sage-gray">{label}</p>
      <p className="mt-2 font-serif text-3xl font-semibold text-primary-dark">{value}</p>
    </Card>
  );
}

function SummarySection({
  query,
}: {
  query: UseQueryResult<DashboardSummaryResponse>;
}): JSX.Element {
  if (query.isLoading) return <LoadingSpinner />;
  if (query.isError) {
    return <ErrorMessage message={getErrorMessage(query.error, 'Could not load summary stats.')} />;
  }
  if (!query.data) return <></>;

  const summary = query.data;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard label="Arrivals Today" value={String(summary.arrivalsToday)} />
      <StatCard label="Departures Today" value={String(summary.departuresToday)} />
      <StatCard
        label="Pending Payment Confirmations"
        value={String(summary.pendingPaymentConfirmations)}
      />
      <StatCard label="Occupancy" value={`${summary.occupancyRatePercent}%`} />
      <StatCard label="Revenue Today" value={formatCurrency(summary.revenueTodayConfirmed)} />
    </div>
  );
}

function OccupancyChart({ query }: { query: UseQueryResult<OccupancyResponse> }): JSX.Element {
  return (
    <Card>
      <h2 className="font-serif text-lg font-semibold text-primary-dark">Occupancy Rate</h2>
      {query.isLoading && <LoadingSpinner className="mt-4" />}
      {query.isError && (
        <ErrorMessage
          className="mt-4"
          message={getErrorMessage(query.error, 'Could not load occupancy data.')}
        />
      )}
      {query.data && query.data.days.length === 0 && (
        <p className="mt-4 font-sans text-sm text-sage-gray">No occupancy data for this range.</p>
      )}
      {query.data && query.data.days.length > 0 && (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={query.data.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#6B726833" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
              <YAxis unit="%" tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={(value) => formatDate(String(value))} />
              <Line
                type="monotone"
                dataKey="occupancyRatePercent"
                name="Occupancy %"
                stroke="#2E4432"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function RevenueChart({ query }: { query: UseQueryResult<RevenueResponse> }): JSX.Element {
  return (
    <Card>
      <h2 className="font-serif text-lg font-semibold text-primary-dark">Revenue</h2>
      {query.isLoading && <LoadingSpinner className="mt-4" />}
      {query.isError && (
        <ErrorMessage
          className="mt-4"
          message={getErrorMessage(query.error, 'Could not load revenue data.')}
        />
      )}
      {query.data && query.data.buckets.length === 0 && (
        <p className="mt-4 font-sans text-sm text-sage-gray">
          No confirmed revenue for this range.
        </p>
      )}
      {query.data && query.data.buckets.length > 0 && (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={query.data.buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="#6B726833" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(Number(value))}
              />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="revenue" name="Revenue" fill="#B49872" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function BookingsByStatusSection({
  query,
}: {
  query: UseQueryResult<BookingsByStatusResponse>;
}): JSX.Element {
  return (
    <Card>
      <h2 className="font-serif text-lg font-semibold text-primary-dark">Bookings by Status</h2>
      {query.isLoading && <LoadingSpinner className="mt-4" />}
      {query.isError && (
        <ErrorMessage
          className="mt-4"
          message={getErrorMessage(query.error, 'Could not load booking status counts.')}
        />
      )}
      {query.data && (
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.values(BookingStatus).map((status) => (
            <div
              key={status}
              className="flex items-center gap-2 rounded-card border border-sage-gray/15 px-3 py-2"
            >
              <Badge tone={getBookingStatusTone(status)}>{status}</Badge>
              <span className="font-sans text-sm font-semibold text-primary-dark">
                {query.data[status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
