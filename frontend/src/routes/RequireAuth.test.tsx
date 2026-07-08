import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import type { AuthContextValue } from '../context/AuthContext';

const mockUseAuth = vi.fn<() => AuthContextValue>();

vi.mock('../context/AuthContext', async () => {
  const actual =
    await vi.importActual<typeof import('../context/AuthContext')>('../context/AuthContext');
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
  };
});

function renderWithAuth(authValue: AuthContextValue) {
  mockUseAuth.mockReturnValue(authValue);
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireAuth requiredRole="Admin">
              <div>Protected Content</div>
            </RequireAuth>
          }
        />
        <Route path="/admin/login" element={<div>Login Page</div>} />
        <Route path="/admin/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('shows a loading spinner while auth state is resolving, without redirecting', () => {
    renderWithAuth({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /admin/login', () => {
    renderWithAuth({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('blocks an authenticated user with the wrong role, redirecting to /admin/dashboard', () => {
    renderWithAuth({
      user: { sub: 1, username: 'staffuser', roleId: 2, roleName: 'Staff' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children for an authenticated user with the correct role', () => {
    renderWithAuth({
      user: { sub: 1, username: 'adminuser', roleId: 1, roleName: 'Admin' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children for an authenticated user when no requiredRole is specified', () => {
    mockUseAuth.mockReturnValue({
      user: { sub: 1, username: 'anyrole', roleId: 3, roleName: 'Anything' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/no-role-required']}>
        <Routes>
          <Route
            path="/no-role-required"
            element={
              <RequireAuth>
                <div>Open Content</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Open Content')).toBeInTheDocument();
  });
});
