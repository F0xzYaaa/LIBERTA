import { beforeEach, describe, expect, it } from 'vitest';
import { getStoredGuestId, setStoredGuestId } from './guestStore';

describe('guestStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredGuestId()).toBeNull();
  });

  it('round-trips a guestId through sessionStorage', () => {
    setStoredGuestId(42);
    expect(getStoredGuestId()).toBe(42);
    expect(sessionStorage.getItem('liberta_guest_id')).toBe('42');
  });

  it('returns null for a corrupted/non-numeric stored value instead of NaN', () => {
    sessionStorage.setItem('liberta_guest_id', 'not-a-number');
    expect(getStoredGuestId()).toBeNull();
  });

  it('returns null for an empty string value', () => {
    sessionStorage.setItem('liberta_guest_id', '');
    expect(getStoredGuestId()).toBeNull();
  });
});
