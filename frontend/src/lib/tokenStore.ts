// In-memory access token + sessionStorage-backed refresh token.
//
// The access token deliberately never touches localStorage/sessionStorage —
// it lives only in this module's closure and is lost on a full page reload,
// which is why AuthContext performs a silent refresh on boot (see
// context/AuthContext.tsx) using the refresh token to obtain a new one.

const REFRESH_TOKEN_STORAGE_KEY = 'liberta_refresh_token';

type TokenChangeListener = () => void;

let accessToken: string | null = null;
const listeners = new Set<TokenChangeListener>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  notifyListeners();
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
}

/** Clears both the in-memory access token and the persisted refresh token. */
export function clearAuthState(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

/** Subscribe to access-token changes (e.g. so AuthContext can re-derive `user`). */
export function subscribeToTokenChanges(listener: TokenChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
