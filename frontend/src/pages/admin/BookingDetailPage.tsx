import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as bookingApi from '../../api/booking.api';
import { BookingResponse, BookingStatus } from '../../api/types/booking.types';
import {
  Badge,
  Button,
  Card,
  ErrorMessage,
  Input,
  LoadingSpinner,
  useToast,
} from '../../components/ui';
import { getBookingStatusTone } from '../../lib/bookingStatusBadge';
import { getErrorMessage, getStatusCode } from '../../lib/apiError';
import { formatCurrency, formatDate } from '../../lib/format';

const MAX_PAYMENT_NOTE_LENGTH = 255;

function bookingQueryKey(id: number): readonly [string, number] {
  return ['bookings', id] as const;
}

export function BookingDetailPage(): JSX.Element {
  const { id: idParam } = useParams<{ id: string }>();
  const bookingId = Number(idParam);
  const isValidId = Number.isFinite(bookingId);

  const bookingQuery = useQuery({
    queryKey: bookingQueryKey(bookingId),
    queryFn: () => bookingApi.findById(bookingId),
    enabled: isValidId,
  });

  if (!isValidId) {
    return (
      <div className="max-w-2xl">
        <ErrorMessage message="Invalid booking id." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl font-semibold text-primary-dark">Booking Detail</h1>

      {bookingQuery.isLoading && <LoadingSpinner />}
      {bookingQuery.isError && (
        <ErrorMessage
          message={getErrorMessage(bookingQuery.error, 'Could not load this booking.')}
        />
      )}
      {bookingQuery.data && <BookingDetails booking={bookingQuery.data} />}
    </div>
  );
}

function BookingDetails({ booking }: { booking: BookingResponse }): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-sm uppercase tracking-wide text-sage-gray">
              Booking #{booking.bookingId}
            </p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-primary-dark">
              {booking.guest.firstName} {booking.guest.lastName}
            </h2>
          </div>
          <Badge tone={getBookingStatusTone(booking.status)}>{booking.status}</Badge>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-y-2 font-sans text-sm">
          <dt className="text-sage-gray">Phone</dt>
          <dd className="text-right font-medium text-primary-dark">{booking.guest.phone}</dd>
          <dt className="text-sage-gray">Email</dt>
          <dd className="text-right font-medium text-primary-dark">{booking.guest.email ?? '—'}</dd>
          <dt className="text-sage-gray">Room</dt>
          <dd className="text-right font-medium text-primary-dark">
            {booking.room.roomNumber} &middot; {booking.room.roomType.typeName}
          </dd>
          <dt className="text-sage-gray">Check-in</dt>
          <dd className="text-right font-medium text-primary-dark">
            {formatDate(booking.checkIn)}
          </dd>
          <dt className="text-sage-gray">Check-out</dt>
          <dd className="text-right font-medium text-primary-dark">
            {formatDate(booking.checkOut)}
          </dd>
          <dt className="text-sage-gray">Guests</dt>
          <dd className="text-right font-medium text-primary-dark">{booking.numGuests}</dd>
          <dt className="text-sage-gray">Total price</dt>
          <dd className="text-right font-medium text-primary-dark">
            {formatCurrency(booking.totalPrice)}
          </dd>
          {booking.specialRequest && (
            <>
              <dt className="text-sage-gray">Special request</dt>
              <dd className="text-right font-medium text-primary-dark">{booking.specialRequest}</dd>
            </>
          )}
          {booking.paymentNote && (
            <>
              <dt className="text-sage-gray">Payment note</dt>
              <dd className="text-right font-medium text-primary-dark">{booking.paymentNote}</dd>
            </>
          )}
          {booking.paymentConfirmedAt && (
            <>
              <dt className="text-sage-gray">Payment confirmed</dt>
              <dd className="text-right font-medium text-primary-dark">
                {formatDate(booking.paymentConfirmedAt)}
              </dd>
            </>
          )}
        </dl>
      </Card>

      {booking.hasSlip && <SlipViewer bookingId={booking.bookingId} />}

      {booking.status === BookingStatus.Draft && (
        <ConfirmPaymentForm bookingId={booking.bookingId} />
      )}
    </div>
  );
}

/**
 * Renders the uploaded payment slip via an authenticated blob fetch --
 * GET /bookings/:id/slip is JWT-protected, so a plain <img src="..."> tag
 * (which cannot attach an Authorization header) would fail. The object URL
 * is revoked on unmount/id-change to avoid leaking memory.
 */
function SlipViewer({ bookingId }: { bookingId: number }): JSX.Element {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;
    setObjectUrl(null);
    setError(null);

    async function loadSlip(): Promise<void> {
      try {
        const blob = await bookingApi.getSlip(bookingId);
        if (cancelled) return;
        currentUrl = URL.createObjectURL(blob);
        setObjectUrl(currentUrl);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the payment slip.'));
      }
    }

    void loadSlip();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [bookingId]);

  return (
    <Card>
      <h2 className="font-serif text-lg font-semibold text-primary-dark">Payment Slip</h2>
      {error && <ErrorMessage className="mt-3" message={error} />}
      {!error && !objectUrl && <LoadingSpinner className="mt-3" />}
      {objectUrl && (
        <img
          src={objectUrl}
          alt="Uploaded payment slip"
          className="mt-3 max-h-96 rounded-card border border-sage-gray/15 object-contain"
        />
      )}
    </Card>
  );
}

function ConfirmPaymentForm({ bookingId }: { bookingId: number }): JSX.Element {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [paymentNote, setPaymentNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!file) {
        return Promise.reject(new Error('Please choose a payment slip image to upload.'));
      }
      return bookingApi.confirmPayment(bookingId, file, { paymentNote: paymentNote.trim() });
    },
    onSuccess: () => {
      showToast('Payment confirmed.', 'success');
      void queryClient.invalidateQueries({ queryKey: bookingQueryKey(bookingId) });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);

    const trimmedNote = paymentNote.trim();
    if (!trimmedNote) {
      setFormError('Please enter a payment note.');
      return;
    }
    if (trimmedNote.length > MAX_PAYMENT_NOTE_LENGTH) {
      setFormError(`Payment note must be ${MAX_PAYMENT_NOTE_LENGTH} characters or fewer.`);
      return;
    }
    if (!file) {
      setFormError('Please choose a payment slip image.');
      return;
    }

    confirmMutation.mutate();
  }

  const mutationErrorMessage = confirmMutation.isError
    ? getStatusCode(confirmMutation.error) === 409
      ? 'This booking is no longer in Draft status — it may have already been confirmed, cancelled, or expired.'
      : getErrorMessage(confirmMutation.error, 'Could not confirm payment. Please try again.')
    : null;

  return (
    <Card>
      <h2 className="font-serif text-lg font-semibold text-primary-dark">Confirm Payment</h2>
      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Payment note"
          required
          maxLength={MAX_PAYMENT_NOTE_LENGTH}
          placeholder="e.g. PromptPay 08/07 14:32"
          value={paymentNote}
          onChange={(e) => setPaymentNote(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-sm font-medium text-primary-dark" htmlFor="slip-file">
            Payment slip image
          </label>
          <input
            id="slip-file"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="font-sans text-sm text-primary-dark"
          />
        </div>
        {formError && <ErrorMessage message={formError} />}
        {mutationErrorMessage && <ErrorMessage message={mutationErrorMessage} />}
        <Button type="submit" disabled={confirmMutation.isPending} className="self-start">
          {confirmMutation.isPending ? 'Confirming...' : 'Confirm Payment'}
        </Button>
      </form>
    </Card>
  );
}
