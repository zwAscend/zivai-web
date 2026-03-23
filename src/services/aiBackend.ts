export interface AiBackendHealth {
  status: 'ok' | 'active';
  contract?: string;
  message?: string;
  baseUrl: string;
  checkedAt: string;
}

const DEFAULT_AI_BACKEND_ORIGIN = 'http://localhost:8000';
const AI_BACKEND_HEALTH_TTL_MS = 5_000;

type CachedHealth = {
  value: AiBackendHealth;
  expiresAt: number;
};

let cachedHealth: CachedHealth | null = null;

function normalizeOrigin(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return DEFAULT_AI_BACKEND_ORIGIN;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function joinUrl(base: string, path: string): string {
  if (!path || path === '/') {
    return base;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function normalizeHealthPayload(payload: Record<string, unknown>): AiBackendHealth | null {
  const rawStatus = typeof payload.status === 'string' ? payload.status.toLowerCase() : '';
  if (rawStatus !== 'ok' && rawStatus !== 'active') {
    return null;
  }

  const contract = typeof payload.contract === 'string' ? payload.contract : '';
  if (contract !== 'zivai_ai_v1') {
    return null;
  }

  return {
    status: rawStatus,
    contract,
    message: typeof payload.message === 'string' ? payload.message : undefined,
    baseUrl: AI_BACKEND_ORIGIN,
    checkedAt: new Date().toISOString(),
  };
}

async function fetchHealth(url: string): Promise<AiBackendHealth | null> {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return isRecord(payload) ? normalizeHealthPayload(payload) : null;
  } catch {
    return null;
  }
}

export const AI_BACKEND_ORIGIN = normalizeOrigin(
  import.meta.env.VITE_AI_BACKEND_URL || import.meta.env.VITE_AI_SERVICE_URL || DEFAULT_AI_BACKEND_ORIGIN
);

export const AI_API_V1_BASE = joinUrl(AI_BACKEND_ORIGIN, '/api/v1');
export const AI_AGENTS_BASE = joinUrl(AI_API_V1_BASE, '/agents');

export function buildAiApiUrl(path: string): string {
  return joinUrl(AI_API_V1_BASE, path);
}

export function buildAiAgentsUrl(path: string): string {
  return joinUrl(AI_AGENTS_BASE, path);
}

export async function ensureAiBackendReady(options?: { force?: boolean }): Promise<AiBackendHealth> {
  const force = options?.force === true;
  if (!force && cachedHealth && cachedHealth.expiresAt > Date.now()) {
    return cachedHealth.value;
  }

  const checks = [
    joinUrl(AI_AGENTS_BASE, '/health-check'),
    joinUrl(AI_API_V1_BASE, '/health'),
  ];

  for (const url of checks) {
    const health = await fetchHealth(url);
    if (health) {
      cachedHealth = {
        value: health,
        expiresAt: Date.now() + AI_BACKEND_HEALTH_TTL_MS,
      };
      return health;
    }
  }

  throw new Error(
    `No compatible ZivAI AI backend is active at ${AI_BACKEND_ORIGIN}. Start a backend that serves the shared zivai_ai_v1 contract before using AI features.`
  );
}
