import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { LoginPage } from './LoginPage';
import * as authApi from '../../api/auth.api';
import type { LoginResponse } from '../../api/types/auth.types';

vi.mock('../../api/auth.api');

function makeAxiosError(status: number, message: string): AxiosError {
  return new AxiosError(`status ${status}`, String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { message },
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/mfa" element={<div>MFA Page Stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits trimmed username + raw password and navigates to /admin/mfa with tempToken + enrollment flag in router state', async () => {
    const response: LoginResponse = {
      tempToken: 'temp-token-abc',
      mfaRequired: true,
      mfaEnrollmentRequired: false,
    };
    vi.mocked(authApi.login).mockResolvedValue(response);

    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), '  admin  ');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('MFA Page Stub')).toBeInTheDocument());
    expect(authApi.login).toHaveBeenCalledWith({ username: 'admin', password: 'password123' });
  });

  it('never persists the tempToken anywhere -- it only ever flows through in-memory router state', async () => {
    const response: LoginResponse = {
      tempToken: 'super-secret-temp-token',
      mfaRequired: true,
      mfaEnrollmentRequired: true,
    };
    vi.mocked(authApi.login).mockResolvedValue(response);

    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('MFA Page Stub')).toBeInTheDocument());
    expect(sessionStorage.getItem('super-secret-temp-token')).toBeNull();
    expect(JSON.stringify(sessionStorage)).not.toContain('super-secret-temp-token');
    expect(JSON.stringify(localStorage)).not.toContain('super-secret-temp-token');
  });

  it('shows an error message and does not navigate on invalid credentials (401)', async () => {
    vi.mocked(authApi.login).mockRejectedValue(makeAxiosError(401, 'Invalid username or password'));

    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument(),
    );
    expect(screen.queryByText('MFA Page Stub')).not.toBeInTheDocument();
  });

  it('disables the submit button and shows "Signing in..." while the request is in flight', async () => {
    let resolveLogin: (value: LoginResponse) => void = () => undefined;
    vi.mocked(authApi.login).mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const pendingButton = await screen.findByRole('button', { name: /signing in/i });
    expect(pendingButton).toBeDisabled();

    resolveLogin({ tempToken: 't', mfaRequired: true, mfaEnrollmentRequired: false });
    await waitFor(() => expect(screen.getByText('MFA Page Stub')).toBeInTheDocument());
  });
});
