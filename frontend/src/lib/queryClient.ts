import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

const MAX_RETRIES = 2;
// These are terminal, non-retryable client errors — retrying wastes a request
// against Nginx's rate-limit zones without any chance of a different outcome.
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 409, 422]);

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === undefined) {
      // Network error / no response at all — worth one retry.
      return true;
    }
    if (NON_RETRYABLE_STATUS_CODES.has(status)) return false;
    // Retry on 429 (rate-limited) and 5xx (transient server error) only.
    return status === 429 || status >= 500;
  }

  return false;
}

function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 10_000);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: shouldRetry,
      retryDelay,
    },
    mutations: {
      retry: false,
    },
  },
});
