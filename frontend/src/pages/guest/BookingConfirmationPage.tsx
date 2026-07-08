import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, LinkButton } from '../../components/ui';
import { formatCurrency } from '../../lib/format';

interface BookingConfirmationState {
  reference: string;
  lockExpiresAt: string;
  totalPrice: number;
}

function isBookingConfirmationState(state: unknown): state is BookingConfirmationState {
  if (typeof state !== 'object' || state === null) return false;
  const candidate = state as Record<string, unknown>;
  return (
    typeof candidate.reference === 'string' &&
    typeof candidate.lockExpiresAt === 'string' &&
    typeof candidate.totalPrice === 'number'
  );
}

/** Recomputes remaining time to `targetIso` every second, e.g. "14:59", or "Expired". */
function useCountdown(targetIso: string): string {
  const target = useMemo(() => new Date(targetIso).getTime(), [targetIso]);
  const [remainingMs, setRemainingMs] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(target - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remainingMs <= 0) return 'Expired';
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// GET /bookings/:id is Staff/Admin-gated (JwtAuthGuard) -- a just-created
// guest has no token to call it with. This page therefore only ever renders
// data passed via router state from BookingNewPage's successful navigation;
// it deliberately never attempts an authenticated fetch by :id.
export function BookingConfirmationPage(): JSX.Element {
  const location = useLocation();
  const state = location.state;

  if (!isBookingConfirmationState(state)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <Card>
          <h1 className="font-serif text-2xl font-semibold text-primary-dark">
            We couldn&apos;t find that booking here
          </h1>
          <p className="mt-3 font-sans text-sage-gray">
            This confirmation page only works right after you complete a booking. If you already
            have a booking, look it up with your reference number instead.
          </p>
          <LinkButton to="/booking/lookup" className="mt-6">
            Find My Booking
          </LinkButton>
        </Card>
      </div>
    );
  }

  return <ConfirmationDetails state={state} />;
}

function ConfirmationDetails({ state }: { state: BookingConfirmationState }): JSX.Element {
  const countdown = useCountdown(state.lockExpiresAt);

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <Card>
        <p className="font-sans text-sm uppercase tracking-wide text-sage-gray">
          Booking Reference
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-primary-dark">
          {state.reference}
        </h1>

        <div className="mt-6 rounded-card bg-cream px-4 py-3">
          <p className="font-sans text-sm text-sage-gray">Your room is held for</p>
          <p className="font-serif text-2xl font-semibold text-primary">{countdown}</p>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-y-2 font-sans text-sm">
          <dt className="text-sage-gray">Total price</dt>
          <dd className="text-right font-medium text-primary-dark">
            {formatCurrency(state.totalPrice)}
          </dd>
        </dl>

        <div className="mt-8 border-t border-sage-gray/15 pt-6">
          <h2 className="font-serif text-lg font-semibold text-primary-dark">
            Next Step: Confirm With Us
          </h2>
          <p className="mt-2 font-sans text-sm text-sage-gray">
            Your room is held for 15 minutes while we wait to hear from you. Contact us on Line or
            Facebook to confirm your booking and arrange payment &mdash; our team will verify and
            secure your reservation.
          </p>
          <ul className="mt-4 flex flex-col gap-1 font-sans text-sm text-primary-dark">
            <li>
              Line: <span className="font-medium">@libertahuahin</span>
            </li>
            <li>
              Facebook: <span className="font-medium">facebook.com/libertahuahin</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
