import { getActiveAuthToken } from './authSession';
export const API_URL = import.meta.env.VITE_API_URL || '/api';

const DEFAULT_GET_CACHE_TTL_MS = 20_000;
const BROWSER_CACHE_PREFIX = 'zivai:http-cache:v1:';

type FetchOptions = RequestInit & {
  skipCache?: boolean;
  cacheTtlMs?: number;
  forceRefresh?: boolean;
};

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

export class ApiError extends Error {
  status: number;
  endpoint: string;
  details?: unknown;

  constructor(status: number, message: string, endpoint: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.details = details;
  }
}

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getBrowserCacheStorageKey(cacheKey: string): string {
  return `${BROWSER_CACHE_PREFIX}${cacheKey}`;
}

function readBrowserCache(cacheKey: string): CacheEntry | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  const storageKey = getBrowserCacheStorageKey(cacheKey);
  const raw = storage.getItem(storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.expiresAt !== 'number') {
      storage.removeItem(storageKey);
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      storage.removeItem(storageKey);
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}

function writeBrowserCache(cacheKey: string, entry: CacheEntry): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(getBrowserCacheStorageKey(cacheKey), JSON.stringify(entry));
  } catch {
    // Best-effort cache; ignore quota/storage errors.
  }
}

function clearBrowserCache(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key && key.startsWith(BROWSER_CACHE_PREFIX)) {
        storage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage access errors.
  }
}

function safeClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildCacheKey(endpoint: string, method: string, token: string | null): string {
  return `${method}:${endpoint}:token=${token ?? 'anon'}`;
}

function sanitizeApiErrorMessage(status: number, rawMessage: string): string {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You are not allowed to access this resource.';
  if (status === 404) return 'Requested data is not available right now.';
  if (status >= 500) return 'Server error. Please try again shortly.';
  if (rawMessage.toLowerCase().includes('no static resource')) {
    return 'Requested data is not available right now.';
  }
  return rawMessage || 'Something went wrong';
}

// Helper function for fetch requests with GET caching + request de-duplication.
export async function fetchData<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const token = getActiveAuthToken();
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = buildCacheKey(endpoint, method, token);
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS;
  const useCache = isGet && !options.skipCache && options.cache !== 'no-store';
  const shouldForceRefresh = !!options.forceRefresh;
  const { skipCache, cacheTtlMs: _cacheTtlMs, forceRefresh, ...requestOptions } = options;

  if (useCache && !shouldForceRefresh) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return safeClone(cached.value as T);
    }
    const browserCached = readBrowserCache(cacheKey);
    if (browserCached) {
      responseCache.set(cacheKey, browserCached);
      return safeClone(browserCached.value as T);
    }
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight.then((value) => safeClone(value as T));
    }
  }

  const isMultipartBody =
    typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;
  const defaultHeaders: HeadersInit = {};
  if (!isMultipartBody) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const requestPromise = (async () => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...requestOptions,
      method,
      headers: {
        ...defaultHeaders,
        ...requestOptions.headers,
      },
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({
        message: '',
      }));
      const rawMessage =
        typeof errorPayload?.message === 'string'
          ? errorPayload.message
          : '';
      const message = sanitizeApiErrorMessage(response.status, rawMessage);
      throw new ApiError(response.status, message, endpoint, errorPayload);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = (await response.json()) as T;

    if (useCache) {
      const cacheEntry: CacheEntry = {
        value: safeClone(data),
        expiresAt: Date.now() + cacheTtlMs,
      };
      responseCache.set(cacheKey, cacheEntry);
      writeBrowserCache(cacheKey, cacheEntry);
    } else {
      // Write operations invalidate read cache to avoid stale UI state.
      responseCache.clear();
      clearBrowserCache();
    }

    return data;
  })();

  if (useCache) {
    inFlightRequests.set(cacheKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (useCache) {
      inFlightRequests.delete(cacheKey);
    }
  }
}
