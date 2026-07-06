import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string | null;

  @Column({ name: 'id_card', type: 'varchar', length: 20, unique: true, nullable: true })
  idCard: string | null;

  @Column({ length: 50, default: 'Thai' })
  nationality: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'loyalty_points', default: 0 })
  loyaltyPoints: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
