import { FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as guestApi from '../../api/guest.api';
import * as bookingApi from '../../api/booking.api';
import { findRoomTypeById } from '../../api/room.api';
import type { GuestResponse, RegisterGuestRequest } from '../../api/types/guest.types';
import type {
  AvailableRoomResponse,
  CreateDraftBookingRequest,
  CreateDraftResponse,
  FindAvailableRoomParams,
} from '../../api/types/booking.types';
import { Button, Card, ErrorMessage, Input, LoadingSpinner, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui';
import { getErrorMessage, getStatusCode } from '../../lib/apiError';
import { formatCurrency } from '../../lib/format';
import { getStoredGuestId, setStoredGuestId } from '../../lib/guestStore';

interface GuestFormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  idCard: string;
}

interface BookingFormState {
  checkIn: string;
  checkOut: string;
  numGuests: string;
  specialRequest: string;
}

const EMPTY_GUEST_FORM: GuestFormState = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  idCard: '',
};

const EMPTY_BOOKING_FORM: BookingFormState = {
  checkIn: '',
  checkOut: '',
  numGuests: '1',
  specialRequest: '',
};

/** Thrown when GET /bookings/available-room 404s -- signals "fully booked", not a generic failure. */
class FullyBookedError extends Error {
  constructor() {
    super('Fully booked for these dates');
    this.name = 'FullyBookedError';
  }
}

interface SubmitDraftInput {
  availability: FindAvailableRoomParams;
  draftBase: Omit<CreateDraftBookingRequest, 'roomId'>;
}

async function resolveAvailableRoom(
  params: FindAvailableRoomParams,
): Promise<AvailableRoomResponse> {
  try {
    return await bookingApi.findAvailableRoom(params);
  } catch (err) {
    if (getStatusCode(err) === 404) {
      throw new FullyBookedError();
    }
    throw err;
  }
}

/**
 * Steps 4-5 of the guest booking flow. Bounded to at most 2 POST
 * /bookings/draft attempts per submission: if the first attempt 409s (room
 * locked by another guest within the 15-min window), re-resolve a candidate
 * room once and retry the draft once more. A second 409 propagates to the
 * caller -- no unbounded retry loop against the sensitive-rate-limited
 * endpoint.
 */
async function submitDraftBooking(input: SubmitDraftInput): Promise<CreateDraftResponse> {
  const firstCandidate = await resolveAvailableRoom(input.availability);
  try {
    return await bookingApi.createDraft({ ...input.draftBase, roomId: firstCandidate.roomId });
  } catch (err) {
    if (getStatusCode(err) !== 409) throw err;
    const retryCandidate = await resolveAvailableRoom(input.availability);
    return await bookingApi.createDraft({ ...input.draftBase, roomId: retryCandidate.roomId });
  }
}

function resolveBookingErrorMessage(error: unknown): string {
  if (error instanceof FullyBookedError) {
    return 'Fully booked for these dates — please try different dates.';
  }
  if (getStatusCode(error) === 409) {
    return 'Please try again in a moment.';
  }
  return getErrorMessage(error, 'We could not complete your booking. Please try again.');
}

export function BookingNewPage(): JSX.Element {
  const { roomTypeId: roomTypeIdParam } = useParams<{ roomTypeId: string }>();
  const roomTypeId = Number(roomTypeIdParam);
  const isValidRoomTypeId = Number.isFinite(roomTypeId);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [guestId, setGuestId] = useState<number | null>(() => getStoredGuestId());
  const [guestForm, setGuestForm] = useState<GuestFormState>(EMPTY_GUEST_FORM);
  const [bookingForm, setBookingForm] = useState<BookingFormState>(EMPTY_BOOKING_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const roomTypeQuery = useQuery({
    queryKey: ['room-type', roomTypeId],
    queryFn: () => findRoomTypeById(roomTypeId),
    enabled: isValidRoomTypeId,
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterGuestRequest) => guestApi.register(payload),
    onSuccess: (guest: GuestResponse) => {
      setStoredGuestId(guest.guestId);
      setGuestId(guest.guestId);
      showToast(`Welcome, ${guest.firstName}! Now pick your dates.`, 'success');
    },
  });

  const bookingMutation = useMutation({
    mutationFn: submitDraftBooking,
    onSuccess: (data) => {
      navigate(`/booking/${data.bookingId}/confirmation`, {
        state: {
          reference: data.reference,
          lockExpiresAt: data.lockExpiresAt,
          totalPrice: data.totalPrice,
        },
      });
    },
  });

  function handleGuestSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const payload: RegisterGuestRequest = {
      firstName: guestForm.firstName.trim(),
      lastName: guestForm.lastName.trim(),
      phone: guestForm.phone.trim(),
    };
    if (guestForm.email.trim()) payload.email = guestForm.email.trim();
    if (guestForm.idCard.trim()) payload.idCard = guestForm.idCard.trim();
    registerMutation.mutate(payload);
  }

  function handleBookingSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);
    if (!guestId) return;

    const { checkIn, checkOut } = bookingForm;
    if (!checkIn || !checkOut) {
      setFormError('Please choose both a check-in and check-out date.');
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      setFormError('Check-out date must be after check-in date.');
      return;
    }

    const numGuests = Number(bookingForm.numGuests);
    if (!Number.isInteger(numGuests) || numGuests < 1) {
      setFormError('Please enter a valid number of guests.');
      return;
    }

    bookingMutation.mutate({
      availability: { roomTypeId, checkIn, checkOut, numGuests },
      draftBase: {
        guestId,
        checkIn,
        checkOut,
        numGuests,
        specialRequest: bookingForm.specialRequest.trim() || undefined,
      },
    });
  }

  if (!isValidRoomTypeId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <ErrorMessage message="Invalid room type." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold text-primary-dark">Book Your Stay</h1>

      {roomTypeQuery.isLoading && <LoadingSpinner className="mt-6" />}
      {roomTypeQuery.isError && (
        <ErrorMessage
          className="mt-6"
          message={getErrorMessage(roomTypeQuery.error, 'Could not load this room type.')}
        />
      )}
      {roomTypeQuery.data && (
        <p className="mt-2 font-sans text-primary-dark/70">
          {roomTypeQuery.data.typeName} &middot; {formatCurrency(roomTypeQuery.data.pricePerNight)}{' '}
          / night &middot; up to {roomTypeQuery.data.capacity} guests
        </p>
      )}

      {!guestId ? (
        <Card className="mt-8">
          <h2 className="font-serif text-xl font-semibold text-primary-dark">1. Your Details</h2>
          <form className="mt-4 flex flex-col gap-4" onSubmit={handleGuestSubmit}>
            <Input
              label="First name"
              required
              value={guestForm.firstName}
              onChange={(e) => setGuestForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <Input
              label="Last name"
              required
              value={guestForm.lastName}
              onChange={(e) => setGuestForm((f) => ({ ...f, lastName: e.target.value }))}
            />
            <Input
              label="Phone"
              required
              value={guestForm.phone}
              onChange={(e) => setGuestForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Email (optional)"
              type="email"
              value={guestForm.email}
              onChange={(e) => setGuestForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="ID card / passport number (optional)"
              value={guestForm.idCard}
              onChange={(e) => setGuestForm((f) => ({ ...f, idCard: e.target.value }))}
            />
            {registerMutation.isError && (
              <ErrorMessage
                message={getErrorMessage(
                  registerMutation.error,
                  'Could not save your details. Please try again.',
                )}
              />
            )}
            <Button type="submit" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? 'Saving...' : 'Continue'}
            </Button>
          </form>
        </Card>
      ) : (
        <Card className="mt-8">
          <h2 className="font-serif text-xl font-semibold text-primary-dark">2. Your Stay</h2>
          <form className="mt-4 flex flex-col gap-4" onSubmit={handleBookingSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Check-in"
                type="date"
                required
                value={bookingForm.checkIn}
                onChange={(e) => setBookingForm((f) => ({ ...f, checkIn: e.target.value }))}
              />
              <Input
                label="Check-out"
                type="date"
                required
                value={bookingForm.checkOut}
                onChange={(e) => setBookingForm((f) => ({ ...f, checkOut: e.target.value }))}
              />
            </div>
            <Input
              label="Number of guests"
              type="number"
              min={1}
              max={roomTypeQuery.data?.capacity}
              required
              value={bookingForm.numGuests}
              onChange={(e) => setBookingForm((f) => ({ ...f, numGuests: e.target.value }))}
            />
            <Textarea
              label="Special requests (optional)"
              value={bookingForm.specialRequest}
              onChange={(e) => setBookingForm((f) => ({ ...f, specialRequest: e.target.value }))}
            />
            {formError && <ErrorMessage message={formError} />}
            {bookingMutation.isError && (
              <ErrorMessage message={resolveBookingErrorMessage(bookingMutation.error)} />
            )}
            <Button type="submit" disabled={bookingMutation.isPending}>
              {bookingMutation.isPending ? 'Checking availability...' : 'Request Booking'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
