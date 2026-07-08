import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { getErrorMessage, getStatusCode } from './apiError';

function makeAxiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data,
  });
  return error;
}

describe('getErrorMessage', () => {
  it('extracts a plain string message from an axios error response', () => {
    const err = makeAxiosError(400, { message: 'Invalid phone format', statusCode: 400 });
    expect(getErrorMessage(err)).toBe('Invalid phone format');
  });

  it('joins an array of validation messages (class-validator style)', () => {
    const err = makeAxiosError(400, {
      message: ['firstName should not be empty', 'phone must be a valid phone number'],
      statusCode: 400,
    });
    expect(getErrorMessage(err)).toBe(
      'firstName should not be empty, phone must be a valid phone number',
    );
  });

  it('falls back to the provided fallback when there is no message field', () => {
    const err = makeAxiosError(500, {});
    expect(getErrorMessage(err, 'custom fallback')).toBe('custom fallback');
  });

  it('falls back to the default fallback when no fallback is provided and no message exists', () => {
    const err = makeAxiosError(500, {});
    expect(getErrorMessage(err)).toBe('Something went wrong. Please try again.');
  });

  it('uses a plain Error object message when not an axios error', () => {
    expect(getErrorMessage(new Error('plain failure'))).toBe('plain failure');
  });

  it('falls back for a non-Error, non-axios thrown value', () => {
    expect(getErrorMessage('just a string', 'fallback here')).toBe('fallback here');
    expect(getErrorMessage(undefined, 'fallback here')).toBe('fallback here');
    expect(getErrorMessage(null, 'fallback here')).toBe('fallback here');
  });
});

describe('getStatusCode', () => {
  it('returns the HTTP status from an axios error', () => {
    const err = makeAxiosError(409, { message: 'Room locked' });
    expect(getStatusCode(err)).toBe(409);
  });

  it('returns undefined for a network error with no response', () => {
    const err = new AxiosError('Network Error');
    expect(getStatusCode(err)).toBeUndefined();
  });

  it('returns undefined for a non-axios error', () => {
    expect(getStatusCode(new Error('oops'))).toBeUndefined();
    expect(getStatusCode('not an error')).toBeUndefined();
  });
});
