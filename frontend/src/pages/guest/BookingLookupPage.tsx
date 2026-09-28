import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as bookingApi from '../../api/booking.api';
import type { LookupBookingResponse } from '../../api/types/booking.types';
import { Button, Card, ErrorMessage, Input } from '../../components/ui';
import { getErrorMessage, getStatusCode } from '../../lib/apiError';
import { formatCurrency, formatDate } from '../../lib/format';

export function BookingLookupPage(): JSX.Element {
  const [reference, setReference] = useState('');
  const [contact, setContact] = useState('');

  const lookupMutation = useMutation({
    mutationFn: () => bookingApi.lookup({ reference: reference.trim(), contact: contact.trim() }),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    lookupMutation.mutate();
  }

  // Matches the backend's own 404 design: no hint about which field (reference
  // vs. contact) was wrong.
  const errorMessage = lookupMutation.isError
    ? getStatusCode(lookupMutation.error) === 404
      ? 'No booking found — check your reference and contact info.'
      : getErrorMessage(lookupMutation.error, 'Could not look up your booking. Please try again.')
    : null;

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold text-primary-dark">Find My Booking</h1>
      <p className="mt-2 font-sans text-primary-dark/70">
        Enter your booking reference along with the phone number or email you registered with.
      </p>

      <Card className="mt-8">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Booking reference"
            placeholder="BK-2026-000042"
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <Input
            label="Phone or email"
            required
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          {errorMessage && <ErrorMessage message={errorMessage} />}
          <Button type="submit" disabled={lookupMutation.isPending}>
            {lookupMutation.isPending ? 'Searching...' : 'Find Booking'}
          </Button>
        </form>
      </Card>

      {lookupMutation.data && <LookupResult booking={lookupMutation.data} />}
    </div>
  );
}

function LookupResult({ booking }: { booking: LookupBookingResponse }): JSX.Element {
  return (
    <Card className="mt-6">
      <p className="font-sans text-sm uppercase tracking-wide text-sage-gray">Booking Reference</p>
      <h2 className="mt-1 font-serif text-2xl font-semibold text-primary-dark">
        {booking.reference}
      </h2>

      <dl className="mt-4 grid grid-cols-2 gap-y-2 font-sans text-sm">
        <dt className="text-sage-gray">Status</dt>
        <dd className="text-right font-medium text-primary-dark">{booking.status}</dd>
        <dt className="text-sage-gray">Room type</dt>
        <dd className="text-right font-medium text-primary-dark">{booking.roomType}</dd>
        <dt className="text-sage-gray">Room number</dt>
        <dd className="text-right font-medium text-primary-dark">{booking.roomNumber}</dd>
        <dt className="text-sage-gray">Check-in</dt>
        <dd className="text-right font-medium text-primary-dark">{formatDate(booking.checkIn)}</dd>
        <dt className="text-sage-gray">Check-out</dt>
        <dd className="text-right font-medium text-primary-dark">{formatDate(booking.checkOut)}</dd>
        <dt className="text-sage-gray">Total price</dt>
        <dd className="text-right font-medium text-primary-dark">
          {formatCurrency(booking.totalPrice)}
        </dd>
      </dl>
    </Card>
  );
}
