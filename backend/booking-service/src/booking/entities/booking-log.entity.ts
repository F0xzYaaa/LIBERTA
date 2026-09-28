import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('BookingLog')
export class BookingLog {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  logId: number;

  @Column({ name: 'booking_id' })
  bookingId: number;

  @Column({ name: 'old_status', type: 'varchar', length: 20, nullable: true })
  oldStatus: string | null;

  @Column({ name: 'new_status', length: 20 })
  newStatus: string;

  @Column({ name: 'changed_by', type: 'int', nullable: true })
  changedBy: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;
}
