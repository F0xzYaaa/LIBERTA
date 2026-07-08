import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from './client';
import {
  clearAuthState,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../lib/tokenStore';

type AdapterFn = (config: InternalAxiosRequestConfig) => Promise<unknown>;

function rejectWithStatus(config: InternalAxiosRequestConfig, status: number, data: unknown = {}) {
  const err = new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    config,
    {},
    {
      status,
      statusText: '',
      headers: new AxiosHeaders(),
      config,
      data,
    },
  );
  return Promise.reject(err);
}

function resolveWith(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return Promise.resolve({
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config,
    data,
  });
}

const originalApiClientAdapter = apiClient.defaults.adapter;
const originalAxiosAdapter = axios.defaults.adapter;

describe('apiClient (interceptors)', () => {
  beforeEach(() => {
    clearAuthState();
    sessionStorage.clear();
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalApiClientAdapter;
    axios.defaults.adapter = originalAxiosAdapter;
    vi.restoreAllMocks();
  });

  it('attaches the Authorization bearer header from tokenStore when a token is present', async () => {
    setAccessToken('my-access-token');
    let capturedAuthHeader: unknown;

    apiClient.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      capturedAuthHeader = config.headers.get('Authorization');
      return resolveWith(config, { ok: true });
    }) as AdapterFn as typeof apiClient.defaults.adapter;

    await apiClient.get('/some/endpoint');
    expect(capturedAuthHeader).toBe('Bearer my-access-token');
  });

  it('does NOT attach an Authorization header when there is no access token', async () => {
    let capturedAuthHeader: unknown = 'unset';

    apiClient.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      capturedAuthHeader = config.headers.get('Authorization');
      return resolveWith(config, { ok: true });
    }) as AdapterFn as typeof apiClient.defaults.adapter;

    await apiClient.get('/public/endpoint');
    // AxiosHeaders#get returns undefined (not null) for a header that was
    // never set -- assert the header is genuinely absent either way.
    expect(capturedAuthHeader).toBeFalsy();
  });

  it('dedupes concurrent 401s into a single /auth/refresh call (single-flight)', async () => {
    setAccessToken('expired-token');
    setRefreshToken('valid-refresh-token');

    let refreshCallCount = 0;
    axios.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/auth/refresh') {
        refreshCallCount += 1;
        return resolveWith(config, {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 900,
        });
      }
      return rejectWithStatus(config, 500, { message: 'unexpected axios.post call in test' });
    }) as AdapterFn as typeof axios.defaults.adapter;

    apiClient.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      const retried = (config as { _retry?: boolean })._retry === true;
      if (retried) {
        return resolveWith(config, { url: config.url, ok: true });
      }
      return rejectWithStatus(config, 401, { message: 'Unauthorized' });
    }) as AdapterFn as typeof apiClient.defaults.adapter;

    const [resultA, resultB] = await Promise.all([apiClient.get('/foo'), apiClient.get('/bar')]);

    expect(resultA.data).toEqual({ url: '/foo', ok: true });
    expect(resultB.data).toEqual({ url: '/bar', ok: true });
    expect(refreshCallCount).toBe(1);
    expect(getAccessToken()).toBe('new-access-token');
  });

  it.each([
    '/auth/login',
    '/auth/refresh',
    '/mfa/generate',
    '/mfa/verify',
    '/mfa/backup-code/verify',
  ])('does NOT attempt a refresh for a 401 from excluded endpoint %s', async (excludedUrl) => {
    let refreshCallCount = 0;
    axios.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      refreshCallCount += 1;
      return rejectWithStatus(config, 500, {});
    }) as AdapterFn as typeof axios.defaults.adapter;

    apiClient.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      return rejectWithStatus(config, 401, { message: 'Unauthorized' });
    }) as AdapterFn as typeof apiClient.defaults.adapter;

    await expect(apiClient.post(excludedUrl, {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refreshCallCount).toBe(0);
  });

  it('does not retry a request more than once (no infinite loop) even if the retried request still 401s', async () => {
    setAccessToken('expired-token');
    setRefreshToken('valid-refresh-token');

    let apiCallCount = 0;
    let refreshCallCount = 0;

    axios.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      refreshCallCount += 1;
      return resolveWith(config, {
        accessToken: 'new-access-token-2',
        refreshToken: 'new-refresh-token-2',
        expiresIn: 900,
      });
    }) as AdapterFn as typeof axios.defaults.adapter;

    apiClient.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      apiCallCount += 1;
      // Always 401s, even after retry with a fresh token -- simulates a
      // still-broken/expired refreshed token.
      return rejectWithStatus(config, 401, { message: 'Unauthorized' });
    }) as AdapterFn as typeof apiClient.defaults.adapter;

    await expect(apiClient.get('/still-broken')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(apiCallCount).toBe(2); // original + exactly one retry
    expect(refreshCallCount).toBe(1);
  });

  it('if the refresh call itself fails, all queued requests reject cleanly and auth state is cleared', async () => {
    setAccessToken('expired-token');
    setRefreshToken('stale-refresh-token');

    axios.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      return rejectWithStatus(config, 401, { message: 'Refresh token invalid' });
    }) as AdapterFn as typeof axios.defaults.adapter;

    apiClient.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      return rejectWithStatus(config, 401, { message: 'Unauthorized' });
    }) as AdapterFn as typeof apiClient.defaults.adapter;

    await expect(Promise.all([apiClient.get('/one'), apiClient.get('/two')])).rejects.toBeTruthy();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('never makes a network refresh call when there is no refresh token stored (fails locally instead)', async () => {
    // No access/refresh token set (cleared in beforeEach). The interceptor
    // still *attempts* refreshAccessToken() (shouldSkipRefresh only checks
    // URL fragments, not token presence) but refreshAccessToken() throws
    // synchronously-ish before ever reaching axios.post, so no network call
    // happens. NOTE: this means the original 401 AxiosError (with .response)
    // is discarded in favor of a plain `Error('No refresh token available')`
    // -- callers relying on getStatusCode()/error.response on this path lose
    // that information. Flagged as a minor finding, not fixed here (test-only file).
    let refreshCallCount = 0;
    axios.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      refreshCallCount += 1;
      return rejectWithStatus(config, 500, {});
    }) as AdapterFn as typeof axios.defaults.adapter;

    apiClient.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      return rejectWithStatus(config, 401, { message: 'Unauthorized' });
    }) as AdapterFn as typeof apiClient.defaults.adapter;

    await expect(apiClient.get('/needs-auth')).rejects.toThrow('No refresh token available');
    expect(refreshCallCount).toBe(0);
    expect(getAccessToken()).toBeNull();
  });

  it('does not retry a non-401 error (e.g. 500) at all', async () => {
    let apiCallCount = 0;
    apiClient.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      apiCallCount += 1;
      return rejectWithStatus(config, 500, { message: 'Server error' });
    }) as AdapterFn as typeof apiClient.defaults.adapter;

    await expect(apiClient.get('/broken')).rejects.toMatchObject({
      response: { status: 500 },
    });
    expect(apiCallCount).toBe(1);
  });
});
