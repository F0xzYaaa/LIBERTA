import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Duplicated from auth-service per architect decision (2026-07-06): each
 * microservice owns its own entity copy rather than a shared package.
 * mfa-service only needs enough columns to resolve an employee for TOTP
 * enrollment/verification — it never reads or writes password_hash.
 */
@Entity('Employee')
export class Employee {
  @PrimaryGeneratedColumn({ name: 'employee_id' })
  employeeId: number;

  @Column({ length: 50, unique: true })
  username: string;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
