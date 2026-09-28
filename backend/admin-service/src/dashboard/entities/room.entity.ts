import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoomType } from './room-type.entity';

export enum RoomStatus {
  Available = 'Available',
  Occupied = 'Occupied',
  Maintenance = 'Maintenance',
  OutOfService = 'OutOfService',
}

/** Read-only duplicate of room-service's Room entity — admin-service never writes to this table. */
@Entity('Room')
export class Room {
  @PrimaryGeneratedColumn({ name: 'room_id' })
  roomId: number;

  @Column({ name: 'room_type_id' })
  roomTypeId: number;

  @ManyToOne(() => RoomType)
  @JoinColumn({ name: 'room_type_id' })
  roomType: RoomType;

  @Column({ name: 'room_number', length: 10, unique: true })
  roomNumber: string;

  @Column()
  floor: number;

  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.Available })
  status: RoomStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
