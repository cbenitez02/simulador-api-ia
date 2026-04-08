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
}

const rateLimitStore = new Map<string, RateLimitBucket>();

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
    evaluate(key: string, limit: number): RateLimitResult {
      const normalizedLimit = normalizeLimit(limit);
      const nowMs = (options.now ?? Date.now)();
      const windowStartMs = getWindowStartMs(nowMs);
      const resetAtMs = getResetAtMs(windowStartMs);
      const current = rateLimitStore.get(key);
      const bucket =
        current && current.windowStartMs === windowStartMs
          ? current
          : ({ windowStartMs, count: 0 } satisfies RateLimitBucket);

      const nextCount = bucket.count + 1;
      const allowed = nextCount <= normalizedLimit;
      const persistedCount = allowed ? nextCount : bucket.count;
      const remaining = Math.max(0, normalizedLimit - persistedCount);
      const nextBucket = { windowStartMs, count: persistedCount } satisfies RateLimitBucket;

      rateLimitStore.set(key, nextBucket);

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
  rateLimitStore.clear();
}
