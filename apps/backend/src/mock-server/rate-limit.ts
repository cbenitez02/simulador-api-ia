import type { PrismaClient } from '@prisma/client';

const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitBucket {
  windowStartMs: number;
  count: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds: number;
  headers: Record<string, string>;
}

interface RuntimeRateLimiterOptions {
  now?: () => number;
  store?: RuntimeRateLimitStore;
}

interface RuntimeRateLimitStore {
  increment(key: string, windowStartMs: number): Promise<number>;
  reset?(): void;
}

function createMemoryRateLimitStore(): RuntimeRateLimitStore {
  const rateLimitStore = new Map<string, RateLimitBucket>();

  return {
    async increment(key: string, windowStartMs: number): Promise<number> {
      const storeKey = `${key}:${windowStartMs}`;
      const bucket = rateLimitStore.get(storeKey) ?? { windowStartMs, count: 0 };
      const nextCount = bucket.count + 1;
      rateLimitStore.set(storeKey, { windowStartMs, count: nextCount });
      return nextCount;
    },
    reset() {
      rateLimitStore.clear();
    },
  };
}

const defaultRateLimitStore = createMemoryRateLimitStore();

export function createPrismaRateLimitStore(
  prisma: Pick<PrismaClient, 'runtimeRateLimitBucket'>
): RuntimeRateLimitStore {
  return {
    async increment(key: string, windowStartMs: number): Promise<number> {
      const bucket = await prisma.runtimeRateLimitBucket.upsert({
        where: {
          projectId_windowStart: {
            projectId: key,
            windowStart: new Date(windowStartMs),
          },
        },
        create: {
          projectId: key,
          windowStart: new Date(windowStartMs),
          requestCount: 1,
        },
        update: {
          requestCount: { increment: 1 },
        },
      });

      return bucket.requestCount;
    },
  };
}

function normalizeLimit(limit: number): number {
  return Math.max(1, Math.floor(limit));
}

function getWindowStartMs(nowMs: number): number {
  return Math.floor(nowMs / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
}

function getResetAtMs(windowStartMs: number): number {
  return windowStartMs + RATE_LIMIT_WINDOW_MS;
}

function getRetryAfterSeconds(resetAtMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
}

function buildRateLimitHeaders(
  limit: number,
  remaining: number,
  resetAtMs: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.floor(resetAtMs / 1000)),
  };
}

export function createRuntimeRateLimiter(options: RuntimeRateLimiterOptions = {}) {
  return {
    async evaluate(key: string, limit: number): Promise<RateLimitResult> {
      const normalizedLimit = normalizeLimit(limit);
      const nowMs = (options.now ?? Date.now)();
      const windowStartMs = getWindowStartMs(nowMs);
      const resetAtMs = getResetAtMs(windowStartMs);
      const requestCount = await (options.store ?? defaultRateLimitStore).increment(
        key,
        windowStartMs
      );
      const allowed = requestCount <= normalizedLimit;
      const remaining = Math.max(0, normalizedLimit - requestCount);

      return {
        allowed,
        limit: normalizedLimit,
        remaining,
        resetAtMs,
        retryAfterSeconds: getRetryAfterSeconds(resetAtMs, nowMs),
        headers: buildRateLimitHeaders(normalizedLimit, remaining, resetAtMs),
      };
    },
  };
}

export function resetRateLimitStoreForTests(): void {
  defaultRateLimitStore.reset?.();
}
