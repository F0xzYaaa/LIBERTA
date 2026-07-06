import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('BackupCode')
export class BackupCode {
  @PrimaryGeneratedColumn({ name: 'code_id' })
  codeId: number;

  @Column({ name: 'employee_id' })
  employeeId: number;

  @Column({ name: 'code_hash', length: 255 })
  codeHash: string;

  @Column({ default: false })
  used: boolean;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
