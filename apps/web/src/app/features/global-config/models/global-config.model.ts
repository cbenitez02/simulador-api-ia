export type LatencyMode = 'fixed' | 'random';

export type LoggingLevel = 'none' | 'basic' | 'verbose';

export type GlobalConfigScope = 'all' | 'without-overrides';

export interface GlobalConfig {
  latency: {
    enabled: boolean;
    minMs: number;
    maxMs: number;
    mode: LatencyMode;
  };
  errorSimulation: {
    enabled: boolean;
    rate: number;
    statusCodes: number[];
  };
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
  };
  logging: {
    level: LoggingLevel;
  };
  scope: GlobalConfigScope;
}

export const GLOBAL_LATENCY_MS_MAX = 2000;

export const GLOBAL_ERROR_STATUS_CODES = [400, 401, 404, 500, 503] as const;

export function createDefaultGlobalConfig(): GlobalConfig {
  return {
    latency: {
      enabled: true,
      minMs: 120,
      maxMs: 800,
      mode: 'random',
    },
    errorSimulation: {
      enabled: true,
      rate: 20,
      statusCodes: [500, 503],
    },
    rateLimiting: {
      enabled: false,
      requestsPerMinute: 100,
    },
    logging: {
      level: 'verbose',
    },
    scope: 'all',
  };
}

export function isServerErrorStatusCode(code: number): boolean {
  return code >= 500;
}
