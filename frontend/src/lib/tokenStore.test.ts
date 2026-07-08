import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAuthState,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  subscribeToTokenChanges,
} from './tokenStore';

describe('tokenStore', () => {
  beforeEach(() => {
    clearAuthState();
    sessionStorage.clear();
  });

  it('starts with no access token and no refresh token', () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('set/get access token round-trips', () => {
    setAccessToken('abc.def.ghi');
    expect(getAccessToken()).toBe('abc.def.ghi');
  });

  it('set/get refresh token round-trips through sessionStorage', () => {
    setRefreshToken('refresh-123');
    expect(getRefreshToken()).toBe('refresh-123');
    expect(sessionStorage.getItem('liberta_refresh_token')).toBe('refresh-123');
  });

  it('setRefreshToken(null) removes the sessionStorage key entirely', () => {
    setRefreshToken('refresh-123');
    setRefreshToken(null);
    expect(getRefreshToken()).toBeNull();
    expect(sessionStorage.getItem('liberta_refresh_token')).toBeNull();
  });

  it('clearAuthState wipes both access and refresh tokens', () => {
    setAccessToken('access-1');
    setRefreshToken('refresh-1');
    clearAuthState();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('the access token never leaks into sessionStorage or localStorage (in-memory only)', () => {
    setAccessToken('super-secret-access-token');
    // Simulate a "reload": a fresh module-scope variable would reset to null,
    // but the real assertion here is that no Storage was ever used as a
    // side channel for the access token.
    const sessionValues = Object.values(sessionStorage).join(' ');
    expect(sessionStorage.getItem('liberta_access_token')).toBeNull();
    expect(JSON.stringify(sessionStorage)).not.toContain('super-secret-access-token');
    expect(JSON.stringify(localStorage)).not.toContain('super-secret-access-token');
    expect(sessionValues).not.toContain('super-secret-access-token');
  });

  it('subscribeToTokenChanges fires on setAccessToken and clearAuthState', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTokenChanges(listener);

    setAccessToken('t1');
    expect(listener).toHaveBeenCalledTimes(1);

    clearAuthState();
    // clearAuthState calls setAccessToken(null) + setRefreshToken(null) --
    // only setAccessToken triggers this listener.
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('unsubscribe stops future notifications', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTokenChanges(listener);
    unsubscribe();

    setAccessToken('t2');
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple independent subscribers', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const unsubA = subscribeToTokenChanges(listenerA);
    const unsubB = subscribeToTokenChanges(listenerB);

    setAccessToken('t3');
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubA();
    setAccessToken('t4');
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(2);

    unsubB();
  });
});
