import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { findRoomTypeById } from '../../api/room.api';
import { ErrorMessage, LinkButton, LoadingSpinner, Card } from '../../components/ui';
import { PackageDetailsList } from '../../components/guest/PackageDetailsList';
import { getErrorMessage } from '../../lib/apiError';
import { formatCurrency } from '../../lib/format';
import heroImage from '../../assets/bb1.jpg';

export function RoomDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const roomTypeId = Number(id);
  const isValidId = Number.isFinite(roomTypeId);

  const {
    data: roomType,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['room-type', roomTypeId],
    queryFn: () => findRoomTypeById(roomTypeId),
    enabled: isValidId,
  });

  if (!isValidId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <ErrorMessage message="This room type could not be found." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {isLoading && <LoadingSpinner />}
      {isError && (
        <ErrorMessage message={getErrorMessage(error, 'Could not load this room type.')} />
      )}

      {roomType && (
        <>
          {/* Static brand imagery only -- not because it's impossible, but not
              implemented yet. GET /rooms/:id/images is public and unguarded,
              and GET /rooms?roomTypeId=X can resolve a Room id for this type,
              so a real per-room-type gallery IS fetchable today via the same
              client-side-join pattern used elsewhere -- just not built here
              yet. Follow-up, not a backend gap. */}
          <img
            src={heroImage}
            alt={roomType.typeName}
            className="h-64 w-full rounded-card object-cover"
          />

          <h1 className="mt-6 font-serif text-3xl font-semibold text-primary-dark">
            {roomType.typeName}
          </h1>
          <p className="mt-2 font-sans text-lg text-primary">
            {formatCurrency(roomType.pricePerNight)} <span className="text-sage-gray">/ night</span>
          </p>
          <p className="mt-1 font-sans text-sm text-sage-gray">Up to {roomType.capacity} guests</p>

          {roomType.description && (
            <p className="mt-4 font-sans text-primary-dark/90">{roomType.description}</p>
          )}

          <Card className="mt-8">
            <h2 className="font-serif text-lg font-semibold text-primary-dark">
              What&apos;s Included
            </h2>
            <div className="mt-4">
              {roomType.packageDetails ? (
                <PackageDetailsList details={roomType.packageDetails} />
              ) : (
                <p className="font-sans text-sm text-sage-gray">
                  No additional details for this room type.
                </p>
              )}
            </div>
          </Card>

          <LinkButton to={`/booking/new/${roomType.roomTypeId}`} className="mt-8">
            Book This Room Type
          </LinkButton>
        </>
      )}
    </div>
  );
}
