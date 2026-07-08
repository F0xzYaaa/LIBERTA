import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { ToastProvider } from '../../components/ui';
import { EmployeesPage } from './EmployeesPage';
import * as authApi from '../../api/auth.api';
import * as mfaApi from '../../api/mfa.api';
import type { EmployeeSummary } from '../../api/types/auth.types';

vi.mock('../../api/auth.api');
vi.mock('../../api/mfa.api');

function makeAxiosError(status: number, message: string): AxiosError {
  return new AxiosError(`status ${status}`, String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { message },
  });
}

const SELF: EmployeeSummary = {
  employeeId: 1,
  username: 'admin',
  fullName: 'Site Admin',
  email: 'admin@liberta.test',
  phone: null,
  roleId: 2,
  roleName: 'Admin',
  mfaEnabled: true,
  isActive: true,
  lastLoginAt: '2026-07-08T09:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const OTHER: EmployeeSummary = {
  employeeId: 2,
  username: 'staffuser',
  fullName: 'Front Desk Staff',
  email: 'staff@liberta.test',
  phone: null,
  roleId: 1,
  roleName: 'Staff',
  mfaEnabled: false,
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <EmployeesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('EmployeesPage self-lockout protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the distinct self-lockout message on a 403 from PATCH /auth/employees/:id, not the generic fallback', async () => {
    vi.mocked(authApi.findAllEmployees).mockResolvedValue([SELF, OTHER]);
    vi.mocked(authApi.findEmployeeById).mockResolvedValue(SELF);
    vi.mocked(authApi.updateEmployee).mockRejectedValue(
      makeAxiosError(403, 'Cannot modify your own account'),
    );

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument());
    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]); // SELF is the first row

    await waitFor(() => expect(screen.getByText('Deactivate Account')).toBeInTheDocument());
    await user.click(screen.getByText('Deactivate Account'));

    await waitFor(() =>
      expect(
        screen.getByText('You cannot modify your own employee account (self-lockout protection).'),
      ).toBeInTheDocument(),
    );
    // The distinct message must replace, not sit alongside, the raw server message.
    expect(screen.queryByText('Cannot modify your own account')).not.toBeInTheDocument();
  });

  it('renders the generic fallback (not the self-lockout message) for a non-403 update failure', async () => {
    vi.mocked(authApi.findAllEmployees).mockResolvedValue([OTHER]);
    vi.mocked(authApi.findEmployeeById).mockResolvedValue(OTHER);
    vi.mocked(authApi.updateEmployee).mockRejectedValue(makeAxiosError(500, 'Internal error'));

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('staffuser')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => expect(screen.getByText('Deactivate Account')).toBeInTheDocument());
    await user.click(screen.getByText('Deactivate Account'));

    await waitFor(() => expect(screen.getByText('Internal error')).toBeInTheDocument());
    expect(
      screen.queryByText('You cannot modify your own employee account (self-lockout protection).'),
    ).not.toBeInTheDocument();
  });

  it('admin resetting another employee MFA shows the new QR/backup codes for that employee', async () => {
    vi.mocked(authApi.findAllEmployees).mockResolvedValue([OTHER]);
    vi.mocked(mfaApi.adminReset).mockResolvedValue({
      qrCodeDataUri: 'data:image/png;base64,newqr',
      manualEntryKey: 'NEWKEY123456',
      backupCodes: ['NEW-0001', 'NEW-0002'],
    });

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('staffuser')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Reset MFA' }));

    await waitFor(() => expect(mfaApi.adminReset).toHaveBeenCalledWith({ employeeId: 2 }));
    expect(await screen.findByText('NEWKEY123456')).toBeInTheDocument();
    expect(screen.getByText('NEW-0001')).toBeInTheDocument();
    expect(screen.getByText('MFA Reset for staffuser')).toBeInTheDocument();
  });
});
