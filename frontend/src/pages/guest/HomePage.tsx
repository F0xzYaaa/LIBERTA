import { useQuery } from '@tanstack/react-query';
import { findAllRoomTypes } from '../../api/room.api';
import { ErrorMessage, LinkButton, LoadingSpinner } from '../../components/ui';
import { RoomTypeCard } from '../../components/guest/RoomTypeCard';
import { getErrorMessage } from '../../lib/apiError';
import heroImage from '../../assets/bb1.jpg';
import logo from '../../assets/LIBERTAR_Logo.png';

const FEATURED_COUNT = 3;

export function HomePage(): JSX.Element {
  // Single call to /room-types is enough for this page -- per-room-type
  // image galleries belong on the detail page, not here.
  const {
    data: roomTypes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['room-types'],
    queryFn: findAllRoomTypes,
  });

  const featured = roomTypes?.slice(0, FEATURED_COUNT) ?? [];

  return (
    <div>
      <section
        className="relative flex min-h-[520px] items-center justify-center bg-cover bg-center text-center text-cream"
        style={{
          backgroundImage: `linear-gradient(rgba(26,42,29,0.55), rgba(26,42,29,0.55)), url(${heroImage})`,
        }}
      >
        <div className="mx-auto max-w-2xl px-6 py-24">
          <img
            src={logo}
            alt="LIBERTA หัวหิน"
            className="mx-auto h-20 w-20 rounded-full object-cover"
          />
          <h1 className="mt-6 font-serif text-4xl font-semibold sm:text-5xl">LIBERTA หัวหิน</h1>
          <p className="mt-4 font-sans text-lg text-cream/90">
            A quiet boutique retreat above the Gulf of Thailand &mdash; sea breeze, garden shade,
            and unhurried Hua Hin mornings.
          </p>
          <LinkButton to="/rooms" variant="secondary" className="mt-8">
            Explore Our Rooms
          </LinkButton>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="font-sans text-sm uppercase tracking-wide text-sage-teal">Welcome</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-primary-dark sm:text-3xl">
          A boutique hotel in the heart of Hua Hin
        </h2>
        <p className="mt-4 max-w-3xl font-sans text-sage-gray">
          LIBERTA หัวหิน is a small, family-run hotel a short stroll from Hua Hin&apos;s beach and
          night market. Every room is designed around a view &mdash; the sea, the garden, or the
          hills behind town &mdash; so your stay feels less like a hotel and more like a quiet
          second home by the coast.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="font-serif text-2xl font-semibold text-primary-dark">Featured Room Types</h2>

        {isLoading && <LoadingSpinner className="mt-8" />}
        {isError && (
          <ErrorMessage
            className="mt-6"
            message={getErrorMessage(error, 'Could not load room types right now.')}
          />
        )}
        {!isLoading && !isError && featured.length === 0 && (
          <p className="mt-6 font-sans text-sage-gray">Room types will be available here soon.</p>
        )}
        {featured.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((roomType) => (
              <RoomTypeCard key={roomType.roomTypeId} roomType={roomType} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
