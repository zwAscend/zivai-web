export const API_URL = import.meta.env.VITE_API_URL || '/api';

const DEFAULT_GET_CACHE_TTL_MS = 20_000;

type FetchOptions = RequestInit & {
  skipCache?: boolean;
  cacheTtlMs?: number;
  forceRefresh?: boolean;
};

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function safeClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildCacheKey(endpoint: string, method: string, token: string | null): string {
  return `${method}:${endpoint}:token=${token ?? 'anon'}`;
}

// Helper function for fetch requests with GET caching + request de-duplication.
export async function fetchData<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = buildCacheKey(endpoint, method, token);
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS;
  const useCache = isGet && !options.skipCache && options.cache !== 'no-store';
  const shouldForceRefresh = !!options.forceRefresh;

  if (useCache && !shouldForceRefresh) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return safeClone(cached.value as T);
    }
    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight.then((value) => safeClone(value as T));
    }
  }

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const { skipCache, cacheTtlMs: _cacheTtlMs, forceRefresh, ...requestOptions } = options;

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
      const error = await response.json().catch(() => ({
        message: 'Something went wrong',
      }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = (await response.json()) as T;

    if (useCache) {
      responseCache.set(cacheKey, {
        value: safeClone(data),
        expiresAt: Date.now() + cacheTtlMs,
      });
    } else {
      // Write operations invalidate read cache to avoid stale UI state.
      responseCache.clear();
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
