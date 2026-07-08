import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Guest } from './guest.entity';
import { Room } from './room.entity';

export enum BookingStatus {
  Draft = 'Draft',
  Reserved = 'Reserved',
  CheckedIn = 'CheckedIn',
  CheckedOut = 'CheckedOut',
  Cancelled = 'Cancelled',
  NoShow = 'NoShow',
  Expired = 'Expired',
}

/** Read-only duplicate of booking-service's Booking entity — admin-service never writes to this table. */
@Entity('Booking')
export class Booking {
  @PrimaryGeneratedColumn({ name: 'booking_id' })
  bookingId: number;

  @Column({ name: 'guest_id' })
  guestId: number;

  @ManyToOne(() => Guest)
  @JoinColumn({ name: 'guest_id' })
  guest: Guest;

  @Column({ name: 'room_id' })
  roomId: number;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @Column({ name: 'check_in', type: 'date' })
  checkIn: string;

  @Column({ name: 'check_out', type: 'date' })
  checkOut: string;

  @Column({ name: 'num_guests', default: 1 })
  numGuests: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.Draft })
  status: BookingStatus;

  @Column({ name: 'lock_expires_at', type: 'datetime', nullable: true })
  lockExpiresAt: Date | null;

  @Column({ name: 'payment_note', type: 'varchar', length: 255, nullable: true })
  paymentNote: string | null;

  @Column({ name: 'slip_image_path', type: 'varchar', length: 500, nullable: true })
  slipImagePath: string | null;

  @Column({ name: 'payment_confirmed_by', type: 'int', nullable: true })
  paymentConfirmedBy: number | null;

  @Column({ name: 'payment_confirmed_at', type: 'datetime', nullable: true })
  paymentConfirmedAt: Date | null;

  @Column({ name: 'special_request', type: 'text', nullable: true })
  specialRequest: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
