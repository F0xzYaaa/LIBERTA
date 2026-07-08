// Full end-to-end integration test of the mandatory staff/admin auth flow:
// password login -> tempToken -> MFA verify (TOTP) -> JWT issued -> protected
// dashboard route becomes reachable. Exercises real react-router navigation
// (no mocked useNavigate) across LoginPage -> MfaPage -> RequireAuth, wired
// the same way router.tsx wires them, with only the network layer mocked.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { LoginPage } from './LoginPage';
import { MfaPage } from './MfaPage';
import { RequireAuth } from '../../routes/RequireAuth';
import { AuthProvider } from '../../context/AuthContext';
import { ToastProvider } from '../../components/ui';
import { clearAuthState, getAccessToken } from '../../lib/tokenStore';
import * as authApi from '../../api/auth.api';
import * as mfaApi from '../../api/mfa.api';
import type { LoginResponse, TokenResponse } from '../../api/types/auth.types';

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

function makeFakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.fakesig`;
}

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/admin/login']}>
            <Routes>
              <Route path="/admin/login" element={<LoginPage />} />
              <Route path="/admin/mfa" element={<MfaPage />} />
              <Route
                path="/admin/dashboard"
                element={
                  <RequireAuth>
                    <div>Real Dashboard Content</div>
                  </RequireAuth>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Admin auth flow (integration): password -> tempToken -> TOTP -> JWT -> dashboard', () => {
  beforeEach(() => {
    clearAuthState();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('no session'));
  });

  afterEach(() => {
    clearAuthState();
    sessionStorage.clear();
  });

  it('completes the full steady-state flow and reaches the protected dashboard with a real JWT', async () => {
    const loginResponse: LoginResponse = {
      tempToken: 'e2e-temp-token',
      mfaRequired: true,
      mfaEnrollmentRequired: false,
    };
    const tokens: TokenResponse = {
      accessToken: makeFakeJwt({ sub: 9, username: 'admin', roleId: 2, roleName: 'Admin' }),
      refreshToken: 'e2e-refresh-token',
      expiresIn: 900,
    };
    vi.mocked(authApi.login).mockResolvedValue(loginResponse);
    vi.mocked(mfaApi.verify).mockResolvedValue(tokens);

    renderApp();
    const user = userEvent.setup();

    // Step 1: password login.
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Step 2: MFA verify -- the tempToken from step 1 flows only through
    // router state into this exact API call, never through storage.
    await screen.findByLabelText('6-digit authenticator code');
    await user.type(screen.getByLabelText('6-digit authenticator code'), '111111');
    await user.click(screen.getByRole('button', { name: /verify/i }));
    expect(mfaApi.verify).toHaveBeenCalledWith({
      tempToken: 'e2e-temp-token',
      totpCode: '111111',
    });

    // Step 3: JWT issued -> RequireAuth on /admin/dashboard now lets the
    // real content through instead of redirecting to /admin/login.
    await waitFor(() => expect(screen.getByText('Real Dashboard Content')).toBeInTheDocument());
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(getAccessToken()).toBe(tokens.accessToken);
  });

  it('a wrong password at step 1 never reaches the MFA step at all', async () => {
    vi.mocked(authApi.login).mockRejectedValue(makeAxiosError(401, 'Invalid username or password'));

    renderApp();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText('6-digit authenticator code')).not.toBeInTheDocument();
    expect(mfaApi.verify).not.toHaveBeenCalled();
  });

  it('correct password + wrong TOTP never reaches the dashboard', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      tempToken: 'e2e-temp-token-2',
      mfaRequired: true,
      mfaEnrollmentRequired: false,
    });
    vi.mocked(mfaApi.verify).mockRejectedValue(makeAxiosError(401, 'Invalid authentication code'));

    renderApp();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await screen.findByLabelText('6-digit authenticator code');
    await user.type(screen.getByLabelText('6-digit authenticator code'), '000000');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() =>
      expect(screen.getByText('Invalid authentication code')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Real Dashboard Content')).not.toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it('directly navigating to the protected dashboard without ever logging in redirects to /admin/login', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={['/admin/dashboard']}>
              <Routes>
                <Route path="/admin/login" element={<div>Login Page</div>} />
                <Route
                  path="/admin/dashboard"
                  element={
                    <RequireAuth>
                      <div>Real Dashboard Content</div>
                    </RequireAuth>
                  }
                />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument());
    expect(screen.queryByText('Real Dashboard Content')).not.toBeInTheDocument();
  });
});
