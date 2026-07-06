import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Duplicated from room-service — booking-service only needs capacity + price for validation/pricing. */
@Entity('RoomType')
export class RoomType {
  @PrimaryGeneratedColumn({ name: 'room_type_id' })
  roomTypeId: number;

  @Column({ name: 'type_name', length: 50 })
  typeName: string;

  @Column({ name: 'price_per_night', type: 'decimal', precision: 10, scale: 2 })
  pricePerNight: number;

  @Column()
  capacity: number;
}
