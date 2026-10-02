// Mirrors backend/auth-service/src/auth/dto/*.ts

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  tempToken: string;
  mfaRequired: boolean;
  mfaEnrollmentRequired: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  /** Access token TTL in seconds */
  expiresIn: number;
}

export interface RegisterEmployeeRequest {
  roleId: number;
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone?: string;
}

/** Shape actually returned by POST /auth/register-employee (a Pick<Employee, ...>, not EmployeeSummaryResponseDto). */
export interface RegisterEmployeeResponse {
  employeeId: number;
  username: string;
  fullName: string;
  email: string;
}

// Never includes passwordHash — the only shape employee data leaves auth-service in.
export interface EmployeeSummary {
  employeeId: number;
  username: string;
  fullName: string;
  email: string;
  phone: string | null;
  roleId: number;
  roleName: string;
  mfaEnabled: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface FindAllEmployeesParams {
  roleId?: number;
  isActive?: boolean;
}

export interface UpdateEmployeeRequest {
  isActive?: boolean;
  roleId?: number;
  fullName?: string;
  email?: string;
  /** null clears the phone number. */
  phone?: string | null;
}

export interface RoleSummary {
  roleId: number;
  roleName: string;
  description: string | null;
}

/** Decoded JWT access-token payload (client-side decode only — never verified in-browser). */
export interface JwtPayload {
  sub: number;
  username: string;
  roleId: number;
  roleName: string;
  iat?: number;
  exp?: number;
}
