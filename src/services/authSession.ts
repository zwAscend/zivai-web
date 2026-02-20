const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const SESSION_ACTIVE_KEY = 'auth_session_active';

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isJwtExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  const exp = typeof payload?.exp === 'number' ? payload.exp : null;
  if (!exp) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds;
}

export function hasActiveBrowserSession(): boolean {
  const session = getSessionStorage();
  if (!session) return false;
  return session.getItem(SESSION_ACTIVE_KEY) === '1';
}

export function markBrowserSessionActive(): void {
  const session = getSessionStorage();
  if (!session) return;
  session.setItem(SESSION_ACTIVE_KEY, '1');
}

export function clearAuthSessionStorage(): void {
  const local = getLocalStorage();
  const session = getSessionStorage();
  local?.removeItem(TOKEN_KEY);
  local?.removeItem(USER_KEY);
  session?.removeItem(SESSION_ACTIVE_KEY);
}

export function getActiveAuthToken(): string | null {
  const local = getLocalStorage();
  if (!local || !hasActiveBrowserSession()) return null;
  const token = local.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isJwtExpired(token)) {
    clearAuthSessionStorage();
    return null;
  }
  return token;
}

export function getActiveUserJson(): string | null {
  const local = getLocalStorage();
  if (!local || !getActiveAuthToken()) return null;
  return local.getItem(USER_KEY);
}

export function isSessionAuthenticated(): boolean {
  return !!getActiveAuthToken();
}

