import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Read-only duplicate of auth-service's Employee entity — admin-service never writes to this
 * table. The Role relation is intentionally omitted (not needed by any dashboard query); roleId
 * is kept as a plain column to preserve the exact column mapping.
 */
@Entity('Employee')
export class Employee {
  @PrimaryGeneratedColumn({ name: 'employee_id' })
  employeeId: number;

  @Column({ name: 'role_id' })
  roleId: number;

  @Column({ length: 50, unique: true })
  username: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ name: 'full_name', length: 100 })
  fullName: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
