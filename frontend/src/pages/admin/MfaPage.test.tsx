import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { MfaPage } from './MfaPage';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { ToastProvider } from '../../components/ui';
import { clearAuthState, getAccessToken, getRefreshToken } from '../../lib/tokenStore';
import * as authApi from '../../api/auth.api';
import * as mfaApi from '../../api/mfa.api';
import type { GenerateMfaResponse } from '../../api/types/mfa.types';
import type { TokenResponse } from '../../api/types/auth.types';

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

const TOKEN_RESPONSE: TokenResponse = {
  accessToken: makeFakeJwt({ sub: 1, username: 'admin', roleId: 1, roleName: 'Admin' }),
  refreshToken: 'issued-refresh-token',
  expiresIn: 900,
};

const ENROLLMENT_RESPONSE: GenerateMfaResponse = {
  qrCodeDataUri: 'data:image/png;base64,fakeqr',
  manualEntryKey: 'ABCD1234EFGH5678',
  backupCodes: ['CODE-0001', 'CODE-0002', 'CODE-0003'],
};

/** Exposes AuthContext's isAuthenticated state for assertions inside the tree under test. */
function AuthProbe(): JSX.Element {
  const { isAuthenticated } = useAuth();
  return <span data-testid="is-authenticated">{String(isAuthenticated)}</span>;
}

function renderMfaPage(state: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <AuthProbe />
          <MemoryRouter initialEntries={[{ pathname: '/admin/mfa', state }]}>
            <Routes>
              <Route path="/admin/login" element={<div>Login Page Stub</div>} />
              <Route path="/admin/mfa" element={<MfaPage />} />
              <Route path="/admin/dashboard" element={<div>Dashboard Page Stub</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('MfaPage', () => {
  beforeEach(() => {
    clearAuthState();
    sessionStorage.clear();
    vi.clearAllMocks();
    // No boot-time refresh token, so AuthProvider's silent refresh is skipped.
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('no refresh token in these tests'));
  });

  afterEach(() => {
    clearAuthState();
    sessionStorage.clear();
  });

  it('redirects to /admin/login when there is no router state (direct nav / page refresh)', async () => {
    renderMfaPage(undefined);
    await waitFor(() => expect(screen.getByText('Login Page Stub')).toBeInTheDocument());
  });

  it('redirects to /admin/login when router state is malformed (missing fields)', async () => {
    renderMfaPage({ tempToken: 'abc' }); // missing mfaEnrollmentRequired
    await waitFor(() => expect(screen.getByText('Login Page Stub')).toBeInTheDocument());
  });

  describe('steady-state verify path (mfaEnrollmentRequired: false)', () => {
    const state = { tempToken: 'temp-token-1', mfaEnrollmentRequired: false };

    it('renders the TOTP form directly, without calling mfa.generate', async () => {
      renderMfaPage(state);
      expect(await screen.findByLabelText('6-digit authenticator code')).toBeInTheDocument();
      expect(mfaApi.generate).not.toHaveBeenCalled();
    });

    it('valid password + WRONG TOTP -> rejected, no JWT issued, stays on MFA page', async () => {
      vi.mocked(mfaApi.verify).mockRejectedValue(
        makeAxiosError(401, 'Invalid authentication code'),
      );
      renderMfaPage(state);

      const user = userEvent.setup();
      await user.type(await screen.findByLabelText('6-digit authenticator code'), '000000');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() =>
        expect(screen.getByText('Invalid authentication code')).toBeInTheDocument(),
      );
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
      expect(getAccessToken()).toBeNull();
      expect(screen.queryByText('Dashboard Page Stub')).not.toBeInTheDocument();
    });

    it('valid password + CORRECT TOTP -> JWT issued, AuthContext becomes authenticated, navigates to dashboard', async () => {
      vi.mocked(mfaApi.verify).mockResolvedValue(TOKEN_RESPONSE);
      renderMfaPage(state);

      const user = userEvent.setup();
      await user.type(await screen.findByLabelText('6-digit authenticator code'), '123456');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => expect(screen.getByText('Dashboard Page Stub')).toBeInTheDocument());
      expect(mfaApi.verify).toHaveBeenCalledWith({ tempToken: 'temp-token-1', totpCode: '123456' });
      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      expect(getAccessToken()).toBe(TOKEN_RESPONSE.accessToken);
      expect(getRefreshToken()).toBe('issued-refresh-token');
    });

    it('temp token expired (401 from mfa/verify, e.g. after 5 minutes) -> rejected, no JWT', async () => {
      vi.mocked(mfaApi.verify).mockRejectedValue(makeAxiosError(401, 'Temp token expired'));
      renderMfaPage(state);

      const user = userEvent.setup();
      await user.type(await screen.findByLabelText('6-digit authenticator code'), '123456');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => expect(screen.getByText('Temp token expired')).toBeInTheDocument());
      expect(getAccessToken()).toBeNull();
    });

    it('toggling to backup-code mode submits via verifyBackupCode instead of verify', async () => {
      vi.mocked(mfaApi.verifyBackupCode).mockResolvedValue(TOKEN_RESPONSE);
      renderMfaPage(state);

      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /use a backup code instead/i }));
      await user.type(screen.getByLabelText('Backup code'), 'CODE-0001');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => expect(screen.getByText('Dashboard Page Stub')).toBeInTheDocument());
      expect(mfaApi.verifyBackupCode).toHaveBeenCalledWith({
        tempToken: 'temp-token-1',
        backupCode: 'CODE-0001',
      });
      expect(mfaApi.verify).not.toHaveBeenCalled();
    });

    it('a backup code that was already used is rejected on the second attempt (single-use semantics surfaced as an error)', async () => {
      vi.mocked(mfaApi.verifyBackupCode)
        .mockResolvedValueOnce(TOKEN_RESPONSE)
        .mockRejectedValueOnce(makeAxiosError(401, 'Backup code already used'));

      // First use: succeeds and navigates away (simulating a fresh login elsewhere).
      const { unmount } = renderMfaPage(state);
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /use a backup code instead/i }));
      await user.type(screen.getByLabelText('Backup code'), 'CODE-0001');
      await user.click(screen.getByRole('button', { name: /verify/i }));
      await waitFor(() => expect(screen.getByText('Dashboard Page Stub')).toBeInTheDocument());
      unmount();
      clearAuthState();

      // Second use of the same code (fresh MFA attempt): must be rejected.
      renderMfaPage(state);
      const user2 = userEvent.setup();
      await user2.click(await screen.findByRole('button', { name: /use a backup code instead/i }));
      await user2.type(screen.getByLabelText('Backup code'), 'CODE-0001');
      await user2.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => expect(screen.getByText('Backup code already used')).toBeInTheDocument());
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('enrollment path (mfaEnrollmentRequired: true)', () => {
    const state = { tempToken: 'temp-token-enroll', mfaEnrollmentRequired: true };

    it('calls mfa.generate on mount and renders the QR code + manual entry key + backup codes', async () => {
      vi.mocked(mfaApi.generate).mockResolvedValue(ENROLLMENT_RESPONSE);
      renderMfaPage(state);

      await waitFor(() => expect(mfaApi.generate).toHaveBeenCalledWith('temp-token-enroll'));
      expect(await screen.findByText('ABCD1234EFGH5678')).toBeInTheDocument();
      expect(screen.getByText('CODE-0001')).toBeInTheDocument();
      expect(screen.getByAltText('Scan with your authenticator app')).toHaveAttribute(
        'src',
        ENROLLMENT_RESPONSE.qrCodeDataUri,
      );
    });

    it('shows an error and never renders the verify form if enrollment generation fails', async () => {
      vi.mocked(mfaApi.generate).mockRejectedValue(
        makeAxiosError(500, 'Could not start MFA enrollment.'),
      );
      renderMfaPage(state);

      await waitFor(() =>
        expect(screen.getByText('Could not start MFA enrollment.')).toBeInTheDocument(),
      );
      expect(screen.queryByLabelText('6-digit authenticator code')).not.toBeInTheDocument();
    });

    it('completes enrollment: generate -> confirm TOTP -> verify -> JWT issued -> dashboard', async () => {
      vi.mocked(mfaApi.generate).mockResolvedValue(ENROLLMENT_RESPONSE);
      vi.mocked(mfaApi.verify).mockResolvedValue(TOKEN_RESPONSE);
      renderMfaPage(state);

      await screen.findByText('ABCD1234EFGH5678');
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('6-digit authenticator code'), '654321');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => expect(screen.getByText('Dashboard Page Stub')).toBeInTheDocument());
      expect(mfaApi.verify).toHaveBeenCalledWith({
        tempToken: 'temp-token-enroll',
        totpCode: '654321',
      });
      expect(getAccessToken()).toBe(TOKEN_RESPONSE.accessToken);
    });
  });
});
