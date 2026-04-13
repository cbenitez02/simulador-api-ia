import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateLatency } from '../latency.js';

describe('mock-server/latency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prioriza latencia global scope=all', () => {
    const latency = calculateLatency(
      200,
      { latencyMode: 'fixed', fixedDelayMs: 10, minDelayMs: 10, maxDelayMs: 20 },
      {
        latencyEnabled: true,
        latencyMode: 'fixed',
        latencyMinMs: 300,
        latencyMaxMs: 900,
      }
    );

    expect(latency).toBe(300);
  });

  it('usa delay del escenario cuando no hay override global', () => {
    const latency = calculateLatency(
      450,
      { latencyMode: 'fixed', fixedDelayMs: 20, minDelayMs: 10, maxDelayMs: 30 },
      {
        latencyEnabled: false,
        latencyMode: 'fixed',
        latencyMinMs: 0,
        latencyMaxMs: 0,
      }
    );

    expect(latency).toBe(450);
  });

  it('usa endpoint config fixed cuando no hay delay de escenario', () => {
    const latency = calculateLatency(
      0,
      { latencyMode: 'fixed', fixedDelayMs: 120, minDelayMs: 10, maxDelayMs: 30 },
      null
    );

    expect(latency).toBe(120);
  });

  it('usa endpoint config range cuando corresponde', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const latency = calculateLatency(
      0,
      { latencyMode: 'range', fixedDelayMs: 0, minDelayMs: 200, maxDelayMs: 500 },
      null
    );

    expect(latency).toBe(200);
  });
});
