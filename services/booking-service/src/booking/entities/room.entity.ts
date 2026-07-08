import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RoomType } from './room-type.entity';

/** Mirrors room-service's RoomStatus enum — duplicated here since booking-service only reads Room.status. */
export enum RoomStatus {
  Available = 'Available',
  Occupied = 'Occupied',
  Maintenance = 'Maintenance',
  OutOfService = 'OutOfService',
}

/** Duplicated from room-service — booking-service only needs enough to validate FK + join to RoomType. */
@Entity('Room')
export class Room {
  @PrimaryGeneratedColumn({ name: 'room_id' })
  roomId: number;

  @Column({ name: 'room_type_id' })
  roomTypeId: number;

  @ManyToOne(() => RoomType)
  @JoinColumn({ name: 'room_type_id' })
  roomType: RoomType;

  @Column({ name: 'room_number', length: 10 })
  roomNumber: string;

  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.Available })
  status: RoomStatus;
}
