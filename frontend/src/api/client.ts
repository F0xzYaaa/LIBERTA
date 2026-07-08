import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearAuthState,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../lib/tokenStore';
import type { TokenResponse } from './types/auth.types';

/** Single axios instance for all six services, proxied same-origin through Nginx at /api. */
export const apiClient = axios.create({
  baseURL: '/api',
});

// Endpoints that must NEVER trigger a silent-refresh-and-retry on 401 — either
// because they precede having any token at all (login, mfa generate/verify),
// or because they *are* the refresh call itself (avoids infinite recursion).
const NO_REFRESH_URL_FRAGMENTS = [
  '/auth/login',
  '/auth/refresh',
  '/mfa/generate',
  '/mfa/verify',
  '/mfa/backup-code/verify',
];

function shouldSkipRefresh(url: string | undefined): boolean {
  if (!url) return false;
  return NO_REFRESH_URL_FRAGMENTS.some((fragment) => url.includes(fragment));
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Deduplicates concurrent refresh attempts: if a refresh is already in-flight,
// callers await the same promise instead of each firing their own /auth/refresh.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const currentRefreshToken = getRefreshToken();
    if (!currentRefreshToken) {
      clearAuthState();
      throw new Error('No refresh token available');
    }

    try {
      // Deliberately bypasses `apiClient` (and therefore its own interceptors)
      // to avoid any risk of recursive 401 handling.
      const response = await axios.post<TokenResponse>('/api/auth/refresh', {
        refreshToken: currentRefreshToken,
      });
      setAccessToken(response.data.accessToken);
      setRefreshToken(response.data.refreshToken);
      return response.data.accessToken;
    } catch (err) {
      clearAuthState();
      throw err;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    const isUnauthorized = error.response?.status === 401;
    const alreadyRetried = originalRequest?._retry === true;
    const skipRefresh = shouldSkipRefresh(originalRequest?.url);

    if (!originalRequest || !isUnauthorized || alreadyRetried || skipRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // If refresh itself fails, auth state is already cleared inside
    // refreshAccessToken(); we simply let this error propagate so the caller
    // (route guards / AuthContext consumers) can react with a redirect.
    const newAccessToken = await refreshAccessToken();
    originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
    return apiClient(originalRequest);
  },
);
