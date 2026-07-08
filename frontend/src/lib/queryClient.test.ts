import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { queryClient } from './queryClient';

function makeAxiosError(status: number): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: {},
  });
}

describe('queryClient default options', () => {
  it('disables refetchOnWindowFocus', () => {
    expect(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });

  it('disables retry for mutations', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
  });

  describe('retry predicate', () => {
    const retry = queryClient.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;

    it('does not retry a 400 Bad Request', () => {
      expect(retry(0, makeAxiosError(400))).toBe(false);
    });

    it('does not retry a 401 Unauthorized', () => {
      expect(retry(0, makeAxiosError(401))).toBe(false);
    });

    it('does not retry a 403 Forbidden', () => {
      expect(retry(0, makeAxiosError(403))).toBe(false);
    });

    it('does not retry a 404 Not Found', () => {
      expect(retry(0, makeAxiosError(404))).toBe(false);
    });

    it('does not retry a 409 Conflict', () => {
      expect(retry(0, makeAxiosError(409))).toBe(false);
    });

    it('does not retry a 422 Unprocessable Entity', () => {
      expect(retry(0, makeAxiosError(422))).toBe(false);
    });

    it('DOES retry a 429 Too Many Requests', () => {
      expect(retry(0, makeAxiosError(429))).toBe(true);
    });

    it('DOES retry a 500 Internal Server Error', () => {
      expect(retry(0, makeAxiosError(500))).toBe(true);
    });

    it('DOES retry a 503 Service Unavailable', () => {
      expect(retry(0, makeAxiosError(503))).toBe(true);
    });

    it('retries a network error with no response at all', () => {
      const networkError = new AxiosError('Network Error');
      expect(retry(0, networkError)).toBe(true);
    });

    it('stops retrying once failureCount reaches the max (2)', () => {
      expect(retry(2, makeAxiosError(500))).toBe(false);
      expect(retry(1, makeAxiosError(500))).toBe(true);
    });

    it('does not retry non-axios errors', () => {
      expect(retry(0, new Error('plain error'))).toBe(false);
    });
  });

  describe('retryDelay', () => {
    const retryDelay = queryClient.getDefaultOptions().queries?.retryDelay as (
      attemptIndex: number,
    ) => number;

    it('backs off exponentially', () => {
      expect(retryDelay(0)).toBe(1000);
      expect(retryDelay(1)).toBe(2000);
      expect(retryDelay(2)).toBe(4000);
    });

    it('caps the delay at 10s', () => {
      expect(retryDelay(10)).toBe(10_000);
    });
  });
});
