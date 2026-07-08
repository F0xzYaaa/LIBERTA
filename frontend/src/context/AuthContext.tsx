import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { jwtDecode } from 'jwt-decode';
import * as authApi from '../api/auth.api';
import type { JwtPayload, TokenResponse } from '../api/types/auth.types';
import {
  clearAuthState,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  subscribeToTokenChanges,
} from '../lib/tokenStore';

export interface AuthUser {
  sub: number;
  username: string;
  roleId: number;
  roleName: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True while the initial silent-refresh-on-boot attempt is in flight. */
  isLoading: boolean;
  /** Commits a freshly-issued token pair (e.g. after POST /mfa/verify succeeds) into the session. */
  login: (tokens: TokenResponse) => void;
  /** Best-effort server-side revoke, then always clears local state regardless of outcome. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeUser(accessToken: string): AuthUser | null {
  try {
    const payload = jwtDecode<JwtPayload>(accessToken);
    return {
      sub: payload.sub,
      username: payload.username,
      roleId: payload.roleId,
      roleName: payload.roleName,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = getAccessToken();
    return token ? decodeUser(token) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Keep `user` in sync with the token store even when the access token is
  // updated from outside React (e.g. the axios response interceptor's silent
  // refresh-and-retry in api/client.ts).
  useEffect(() => {
    return subscribeToTokenChanges(() => {
      const token = getAccessToken();
      setUser(token ? decodeUser(token) : null);
    });
  }, []);

  // On app boot: if a refresh token survived in sessionStorage (e.g. a page
  // reload), attempt one silent refresh before rendering protected routes.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      const existingRefreshToken = getRefreshToken();
      if (!existingRefreshToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const tokens = await authApi.refresh(existingRefreshToken);
        if (cancelled) return;
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
      } catch {
        if (!cancelled) clearAuthState();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((tokens: TokenResponse) => {
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: proceed to clear local state regardless of server outcome.
    } finally {
      clearAuthState();
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook is colocated with its provider by design
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
