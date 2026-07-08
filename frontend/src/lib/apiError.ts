// Helpers for turning an unknown thrown value (almost always an AxiosError
// from api/client.ts) into something safe to show a guest. Most NestJS
// exceptions in this project return `{ statusCode, message, error }` JSON,
// but this is NOT guaranteed uniform -- e.g. booking.service.ts's 409
// ConflictException passes an object body (`{ message, lockExpiresAt }`)
// that NestJS does not enrich with statusCode/error. Only `.message` is
// read below; do not assume `.statusCode`/`.error` exist on every body.

import axios from 'axios';

interface ApiErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

/** Extracts a human-readable message from a thrown error, falling back to `fallback`. */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError(error)) {
    // AxiosError is itself `instanceof Error` with a generic message like
    // "Request failed with status code 500" -- return here, before the
    // generic Error branch below, so a response body with no `.message`
    // falls through to `fallback` instead of that generic axios message.
    const data = error.response?.data as ApiErrorBody | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    return fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

/** Returns the HTTP status code of an axios error, or undefined if not an axios error / no response. */
export function getStatusCode(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.status;
  }
  return undefined;
}
