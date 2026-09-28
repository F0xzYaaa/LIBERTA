import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('MFASecret')
export class MFASecret {
  @PrimaryGeneratedColumn({ name: 'mfa_id' })
  mfaId: number;

  @Column({ name: 'employee_id', unique: true })
  employeeId: number;

  @Column({ length: 255 })
  secret: string;

  @Column({ name: 'activated_at', type: 'datetime', nullable: true })
  activatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
