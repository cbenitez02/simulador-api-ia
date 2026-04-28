import type { HttpMethod } from '../../../../shared/models/endpoint-preview.model';

export interface UsageEndpointUsageTrend {
  readonly direction: 'up' | 'down';
  readonly pct: number;
}

export interface UsageEndpointUsageRow {
  readonly id: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly requests: number;
  readonly avgLatencyMs: number;
  /** 0–100 (e.g. 2.3 for 2.3%). */
  readonly errorRatePct: number;
  readonly trend: UsageEndpointUsageTrend;
  readonly mostUsed?: boolean;
}

export const USAGE_ENDPOINT_USAGE_MOCK: readonly UsageEndpointUsageRow[] = [
  {
    id: 'post-users',
    method: 'POST',
    path: '/users',
    requests: 3200,
    avgLatencyMs: 145,
    errorRatePct: 2.3,
    trend: { direction: 'up', pct: 8 },
    mostUsed: true,
  },
  {
    id: 'get-orders',
    method: 'GET',
    path: '/orders',
    requests: 756,
    avgLatencyMs: 234,
    errorRatePct: 5.6,
    trend: { direction: 'down', pct: 12 },
  },
  {
    id: 'get-products',
    method: 'GET',
    path: '/products',
    requests: 2100,
    avgLatencyMs: 98,
    errorRatePct: 0.8,
    trend: { direction: 'up', pct: 3 },
  },
  {
    id: 'patch-users-me',
    method: 'PATCH',
    path: '/users/me',
    requests: 412,
    avgLatencyMs: 189,
    errorRatePct: 1.2,
    trend: { direction: 'down', pct: 4 },
  },
  {
    id: 'delete-sessions',
    method: 'DELETE',
    path: '/sessions/:id',
    requests: 128,
    avgLatencyMs: 312,
    errorRatePct: 3.1,
    trend: { direction: 'up', pct: 2 },
  },
] as const;
