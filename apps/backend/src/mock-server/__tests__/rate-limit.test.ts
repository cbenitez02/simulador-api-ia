import { describe, expect, it } from 'vitest';
import { createRuntimeRateLimiter, resetRateLimitStoreForTests } from '../rate-limit.js';

describe('mock-server/rate-limit', () => {
  it('allow/exhaust dentro de la misma ventana alineada con headers consistentes', () => {
    const nowMs = 65_000;
    const limiter = createRuntimeRateLimiter({ now: () => nowMs });

    const first = limiter.evaluate('project-1', 2);
    const second = limiter.evaluate('project-1', 2);
    const third = limiter.evaluate('project-1', 2);

    expect(first).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetAtMs: 120_000,
      retryAfterSeconds: 55,
      headers: {
        'X-RateLimit-Limit': '2',
        'X-RateLimit-Remaining': '1',
        'X-RateLimit-Reset': '120',
      },
    });

    expect(second).toMatchObject({
      allowed: true,
      limit: 2,
      remaining: 0,
      resetAtMs: 120_000,
      retryAfterSeconds: 55,
      headers: {
        'X-RateLimit-Limit': '2',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '120',
      },
    });

    expect(third).toMatchObject({
      allowed: false,
      limit: 2,
      remaining: 0,
      resetAtMs: 120_000,
      retryAfterSeconds: 55,
      headers: {
        'X-RateLimit-Limit': '2',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '120',
      },
    });
  });

  it('resetea la cuota cuando cambia la ventana', () => {
    let nowMs = 65_000;
    const limiter = createRuntimeRateLimiter({ now: () => nowMs });

    limiter.evaluate('project-1', 1);
    const blocked = limiter.evaluate('project-1', 1);

    nowMs = 121_000;

    const reset = limiter.evaluate('project-1', 1);

    expect(blocked).toMatchObject({
      allowed: false,
      remaining: 0,
      resetAtMs: 120_000,
      retryAfterSeconds: 55,
    });

    expect(reset).toMatchObject({
      allowed: true,
      limit: 1,
      remaining: 0,
      resetAtMs: 180_000,
      retryAfterSeconds: 59,
      headers: {
        'X-RateLimit-Limit': '1',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '180',
      },
    });
  });

  it('resetRateLimitStoreForTests limpia el store compartido', () => {
    const nowMs = 10_000;
    const firstLimiter = createRuntimeRateLimiter({ now: () => nowMs });

    firstLimiter.evaluate('project-1', 1);
    expect(firstLimiter.evaluate('project-1', 1).allowed).toBe(false);

    resetRateLimitStoreForTests();

    const secondLimiter = createRuntimeRateLimiter({ now: () => nowMs });
    expect(secondLimiter.evaluate('project-1', 1)).toMatchObject({
      allowed: true,
      remaining: 0,
      resetAtMs: 60_000,
      retryAfterSeconds: 50,
    });
  });
});
