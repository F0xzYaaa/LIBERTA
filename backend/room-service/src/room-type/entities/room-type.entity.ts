import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('RoomType')
export class RoomType {
  @PrimaryGeneratedColumn({ name: 'room_type_id' })
  roomTypeId: number;

  @Column({ name: 'type_name', length: 50, unique: true })
  typeName: string;

  @Column({ name: 'price_per_night', type: 'decimal', precision: 10, scale: 2 })
  pricePerNight: number;

  @Column()
  capacity: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'package_details', type: 'json', nullable: true })
  packageDetails: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
