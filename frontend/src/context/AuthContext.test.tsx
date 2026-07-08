import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import {
  clearAuthState,
  getAccessToken,
  getRefreshToken,
  setRefreshToken,
} from '../lib/tokenStore';
import * as authApi from '../api/auth.api';

vi.mock('../api/auth.api');

function makeFakeJwt(payload: Record<string, unknown>): string {
  // btoa/atob (not Buffer) -- this file runs under the jsdom test environment,
  // which polyfills the browser's base64 globals, not Node's Buffer.
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.fakesig`;
}

const VALID_JWT_PAYLOAD = { sub: 1, username: 'admin', roleId: 1, roleName: 'Admin' };

function TestConsumer(): JSX.Element {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="username">{user?.username ?? 'none'}</span>
      <button
        onClick={() =>
          login({
            accessToken: makeFakeJwt(VALID_JWT_PAYLOAD),
            refreshToken: 'fresh-refresh-token',
            expiresIn: 900,
          })
        }
      >
        login
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    clearAuthState();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearAuthState();
    sessionStorage.clear();
  });

  it('boots with a valid stored refresh token -> isAuthenticated becomes true after silent refresh', async () => {
    setRefreshToken('existing-refresh-token');
    vi.mocked(authApi.refresh).mockResolvedValue({
      accessToken: makeFakeJwt(VALID_JWT_PAYLOAD),
      refreshToken: 'rotated-refresh-token',
      expiresIn: 900,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('username').textContent).toBe('admin');
    expect(authApi.refresh).toHaveBeenCalledWith('existing-refresh-token');
    expect(getRefreshToken()).toBe('rotated-refresh-token');
  });

  it('boots with no stored token -> isLoading resolves false, isAuthenticated false, no network call', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  it('boots with an invalid/expired refresh token -> clears auth state, does not crash', async () => {
    setRefreshToken('stale-refresh-token');
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('refresh token expired'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('logout clears tokenStore and flips isAuthenticated back to false', async () => {
    vi.mocked(authApi.logout).mockResolvedValue({ message: 'logged out' });

    const { user: userEvent } = await import('@testing-library/user-event').then((mod) => ({
      user: mod.default.setup(),
    }));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await userEvent.click(screen.getByText('login'));
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    await userEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('logout still clears local state even if the server-side revoke call fails', async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network error'));

    const { user: userEvent } = await import('@testing-library/user-event').then((mod) => ({
      user: mod.default.setup(),
    }));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await userEvent.click(screen.getByText('login'));
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    await userEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('authenticated').textContent).toBe('false'));
    expect(getAccessToken()).toBeNull();
  });

  it('useAuth throws when used outside an AuthProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider');
    consoleErrorSpy.mockRestore();
  });
});
