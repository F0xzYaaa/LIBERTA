import { ChangeEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as bookingApi from '../../api/booking.api';
import { BookingStatus, FindAllBookingsParams } from '../../api/types/booking.types';
import { Badge, Card, ErrorMessage, Input, LoadingSpinner, Select } from '../../components/ui';
import { getBookingStatusTone } from '../../lib/bookingStatusBadge';
import { getErrorMessage } from '../../lib/apiError';
import { formatCurrency, formatDate } from '../../lib/format';

interface FilterFormState {
  status: string;
  roomId: string;
  checkInFrom: string;
  checkInTo: string;
}

const EMPTY_FILTERS: FilterFormState = {
  status: '',
  roomId: '',
  checkInFrom: '',
  checkInTo: '',
};

const STATUS_OPTIONS = Object.values(BookingStatus).map((status) => ({
  value: status,
  label: status,
}));

function toQueryParams(filters: FilterFormState): FindAllBookingsParams {
  const params: FindAllBookingsParams = {};
  if (filters.status) params.status = filters.status as BookingStatus;
  if (filters.roomId.trim()) {
    const roomId = Number(filters.roomId);
    if (Number.isInteger(roomId) && roomId > 0) params.roomId = roomId;
  }
  if (filters.checkInFrom) params.checkInFrom = filters.checkInFrom;
  if (filters.checkInTo) params.checkInTo = filters.checkInTo;
  return params;
}

export function BookingsPage(): JSX.Element {
  const [filters, setFilters] = useState<FilterFormState>(EMPTY_FILTERS);
  const queryParams = useMemo(() => toQueryParams(filters), [filters]);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', queryParams],
    queryFn: () => bookingApi.findAll(queryParams),
  });

  function updateFilter(key: keyof FilterFormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      const value = event.target.value;
      setFilters((current) => ({ ...current, [key]: value }));
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl font-semibold text-primary-dark">Bookings</h1>

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Status"
            placeholder="All statuses"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={updateFilter('status')}
          />
          <Input
            label="Room ID"
            type="number"
            min={1}
            value={filters.roomId}
            onChange={updateFilter('roomId')}
          />
          <Input
            label="Check-in from"
            type="date"
            value={filters.checkInFrom}
            onChange={updateFilter('checkInFrom')}
          />
          <Input
            label="Check-in to"
            type="date"
            value={filters.checkInTo}
            onChange={updateFilter('checkInTo')}
          />
        </div>
      </Card>

      {bookingsQuery.isLoading && <LoadingSpinner />}
      {bookingsQuery.isError && (
        <ErrorMessage message={getErrorMessage(bookingsQuery.error, 'Could not load bookings.')} />
      )}
      {bookingsQuery.data && bookingsQuery.data.length === 0 && (
        <p className="font-sans text-sage-gray">No bookings match these filters.</p>
      )}
      {bookingsQuery.data && bookingsQuery.data.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left font-sans text-sm">
            <thead className="border-b border-sage-gray/15 text-xs uppercase tracking-wide text-sage-gray">
              <tr>
                <th className="px-4 py-3 font-medium">Booking</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="px-4 py-3 font-medium">Check-out</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookingsQuery.data.map((booking) => (
                <tr
                  key={booking.bookingId}
                  className="border-b border-sage-gray/10 last:border-0 hover:bg-cream/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/bookings/${booking.bookingId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      #{booking.bookingId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-primary-dark">
                    {booking.guest.firstName} {booking.guest.lastName}
                  </td>
                  <td className="px-4 py-3 text-primary-dark">
                    {booking.room.roomNumber} &middot; {booking.room.roomType.typeName}
                  </td>
                  <td className="px-4 py-3 text-primary-dark">{formatDate(booking.checkIn)}</td>
                  <td className="px-4 py-3 text-primary-dark">{formatDate(booking.checkOut)}</td>
                  <td className="px-4 py-3 text-primary-dark">
                    {formatCurrency(booking.totalPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={getBookingStatusTone(booking.status)}>{booking.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
