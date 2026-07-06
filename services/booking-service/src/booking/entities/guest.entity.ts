import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Duplicated from guest-service — booking-service only needs enough to validate FK + lookup contact. */
@Entity('Guest')
export class Guest {
  @PrimaryGeneratedColumn({ name: 'guest_id' })
  guestId: number;

  @Column({ name: 'first_name', length: 50 })
  firstName: string;

  @Column({ name: 'last_name', length: 50 })
  lastName: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string | null;
}
