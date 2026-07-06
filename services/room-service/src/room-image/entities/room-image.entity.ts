import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('RoomImage')
export class RoomImage {
  @PrimaryGeneratedColumn({ name: 'image_id' })
  imageId: number;

  @Column({ name: 'room_id' })
  roomId: number;

  @Column({ name: 'image_path', length: 500 })
  imagePath: string;

  @Column({ length: 200, nullable: true })
  caption: string | null;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @Column({ name: 'file_size', nullable: true })
  fileSize: number | null;

  @Column({ name: 'mime_type', length: 50, nullable: true })
  mimeType: string | null;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}
