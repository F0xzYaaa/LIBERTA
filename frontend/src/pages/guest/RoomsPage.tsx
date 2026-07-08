import { useQuery } from '@tanstack/react-query';
import { findAllRoomTypes } from '../../api/room.api';
import { ErrorMessage, LoadingSpinner } from '../../components/ui';
import { RoomTypeCard } from '../../components/guest/RoomTypeCard';
import { getErrorMessage } from '../../lib/apiError';

export function RoomsPage(): JSX.Element {
  const {
    data: roomTypes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['room-types'],
    queryFn: findAllRoomTypes,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold text-primary-dark">Our Rooms</h1>
      <p className="mt-2 max-w-2xl font-sans text-sage-gray">
        Each room type is built around a different view of Hua Hin &mdash; from sea-facing suites to
        quiet garden and hillside retreats.
      </p>

      {isLoading && <LoadingSpinner className="mt-8" />}
      {isError && (
        <ErrorMessage
          className="mt-6"
          message={getErrorMessage(error, 'Could not load room types right now.')}
        />
      )}
      {roomTypes && roomTypes.length === 0 && (
        <p className="mt-8 font-sans text-sage-gray">No room types are available right now.</p>
      )}
      {roomTypes && roomTypes.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {roomTypes.map((roomType) => (
            <RoomTypeCard key={roomType.roomTypeId} roomType={roomType} />
          ))}
        </div>
      )}
    </div>
  );
}
