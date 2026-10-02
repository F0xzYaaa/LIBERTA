import { apiClient } from './client';
import type {
  EmployeeSummary,
  FindAllEmployeesParams,
  LoginRequest,
  LoginResponse,
  RegisterEmployeeRequest,
  RegisterEmployeeResponse,
  RoleSummary,
  TokenResponse,
  UpdateEmployeeRequest,
} from './types/auth.types';

/** Step 1 of staff/admin login: verify password, get a tempToken. */
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload);
  return data;
}

/** Admin-only: create a new staff/admin account. */
export async function registerEmployee(
  payload: RegisterEmployeeRequest,
): Promise<RegisterEmployeeResponse> {
  const { data } = await apiClient.post<RegisterEmployeeResponse>(
    '/auth/register-employee',
    payload,
  );
  return data;
}

/** Rotate a refresh token for a new access+refresh pair. */
export async function refresh(refreshToken: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/refresh', { refreshToken });
  return data;
}

/** Revoke the current refresh token, forcing re-login on next expiry. */
export async function logout(): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>('/auth/logout');
  return data;
}

/** Admin-only: list employees, optionally filtered by role/active state. */
export async function findAllEmployees(
  filters: FindAllEmployeesParams = {},
): Promise<EmployeeSummary[]> {
  const { data } = await apiClient.get<EmployeeSummary[]>('/auth/employees', {
    params: {
      roleId: filters.roleId,
      isActive: filters.isActive === undefined ? undefined : String(filters.isActive),
    },
  });
  return data;
}

/** Admin-only: get a single employee by id. */
export async function findEmployeeById(id: number): Promise<EmployeeSummary> {
  const { data } = await apiClient.get<EmployeeSummary>(`/auth/employees/${id}`);
  return data;
}

/** Admin-only: activate/deactivate an employee or change their role. */
export async function updateEmployee(
  id: number,
  payload: UpdateEmployeeRequest,
): Promise<EmployeeSummary> {
  const { data } = await apiClient.patch<EmployeeSummary>(`/auth/employees/${id}`, payload);
  return data;
}

/** Admin-only: list roles for role pickers. */
export async function findAllRoles(): Promise<RoleSummary[]> {
  const { data } = await apiClient.get<RoleSummary[]>('/auth/roles');
  return data;
}

/** Admin-only: delete an employee. Fails with 409 if they appear in booking history. */
export async function deleteEmployee(id: number): Promise<void> {
  await apiClient.delete(`/auth/employees/${id}`);
}
