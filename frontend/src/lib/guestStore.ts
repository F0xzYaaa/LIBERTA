// sessionStorage-backed guest identity for the public booking flow. Storing
// only the numeric guestId (never guest PII) lets a returning visitor skip
// re-registering within the same browser session -- mirrors the
// refresh-token persistence pattern in tokenStore.ts, but for guests, who
// never receive a JWT at all (POST /bookings/draft takes a raw guestId,
// established in Stage 3).

const GUEST_ID_STORAGE_KEY = 'liberta_guest_id';

/** Returns the stored guestId from a prior registration this session, or null if none/invalid. */
export function getStoredGuestId(): number | null {
  const raw = sessionStorage.getItem(GUEST_ID_STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Persists the guestId returned by POST /guests/register for the rest of this browser session. */
export function setStoredGuestId(guestId: number): void {
  sessionStorage.setItem(GUEST_ID_STORAGE_KEY, String(guestId));
}
