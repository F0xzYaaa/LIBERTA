// Mirrors backend/admin-service/src/dashboard/dto/*.ts

export interface DashboardSummaryResponse {
  arrivalsToday: number;
  departuresToday: number;
  pendingPaymentConfirmations: number;
  occupiedRoomsToday: number;
  totalActiveRooms: number;
  occupancyRatePercent: number;
  revenueTodayConfirmed: number;
}

export interface OccupancyQueryParams {
  from: string;
  to: string;
}

export interface OccupancyDay {
  date: string;
  occupiedRooms: number;
  totalActiveRooms: number;
  occupancyRatePercent: number;
}

export interface OccupancyResponse {
  from: string;
  to: string;
  days: OccupancyDay[];
}

export enum RevenueGroupBy {
  Day = 'day',
  Month = 'month',
}

export interface RevenueQueryParams {
  from: string;
  to: string;
  groupBy: RevenueGroupBy;
}

export interface RevenueBucket {
  period: string;
  revenue: number;
}

export interface RevenueResponse {
  from: string;
  to: string;
  groupBy: RevenueGroupBy;
  buckets: RevenueBucket[];
}

export interface BookingsByStatusResponse {
  Draft: number;
  Reserved: number;
  CheckedIn: number;
  CheckedOut: number;
  Cancelled: number;
  NoShow: number;
  Expired: number;
}
