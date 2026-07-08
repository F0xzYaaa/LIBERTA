import { Card, LinkButton } from '../ui';
import type { RoomType } from '../../api/types/room.types';
import { formatCurrency } from '../../lib/format';

export interface RoomTypeCardProps {
  roomType: RoomType;
}

/** Summary card for a RoomType, used on both the homepage's featured section and the full rooms list. */
export function RoomTypeCard({ roomType }: RoomTypeCardProps): JSX.Element {
  return (
    <Card className="flex flex-col">
      <h3 className="font-serif text-xl font-semibold text-primary-dark">{roomType.typeName}</h3>
      <p className="mt-1 font-sans text-sm text-sage-gray">
        {formatCurrency(roomType.pricePerNight)} / night &middot; up to {roomType.capacity} guests
      </p>
      {roomType.description && (
        <p className="mt-3 line-clamp-3 font-sans text-sm text-primary-dark/80">
          {roomType.description}
        </p>
      )}
      <LinkButton to={`/rooms/${roomType.roomTypeId}`} variant="secondary" className="mt-4 w-full">
        View
      </LinkButton>
    </Card>
  );
}
