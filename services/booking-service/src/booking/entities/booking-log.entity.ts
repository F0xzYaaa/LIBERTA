import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('BookingLog')
export class BookingLog {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  logId: number;

  @Column({ name: 'booking_id' })
  bookingId: number;

  @Column({ name: 'old_status', length: 20, nullable: true })
  oldStatus: string | null;

  @Column({ name: 'new_status', length: 20 })
  newStatus: string;

  @Column({ name: 'changed_by', nullable: true })
  changedBy: number | null;

  @Column({ length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}
