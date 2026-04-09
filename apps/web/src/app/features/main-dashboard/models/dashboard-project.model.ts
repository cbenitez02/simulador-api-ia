import type { EndpointPreview } from '../../../shared/models/endpoint-preview.model';

export type DashboardProjectStatus = 'empty' | 'attention' | 'running';
export type DashboardEndpointStatus = 'ready' | 'needs-attention';

export interface DashboardMetrics {
  totalEndpoints: number;
  totalScenarios: number;
  avgLatencyMs: number;
  errorRatePct: number;
  totalRequests: number;
}

export interface DashboardHealth {
  readyEndpoints: number;
  needsAttentionEndpoints: number;
  errorScenarioEndpoints: number;
  emptyScenarioEndpoints: number;
  timeoutScenarioEndpoints: number;
}

export interface DashboardEndpointRow {
  endpointId: string;
  method: EndpointPreview['method'];
  path: string;
  description: string;
  scenarioCount: number;
  latencyMs: number;
  errorRatePct: number;
  status: DashboardEndpointStatus;
}

export interface DashboardRecentRequest {
  id: string;
  method: EndpointPreview['method'];
  path: string;
  statusCode: number;
  latencyMs: number;
  scenarioType: string;
  createdAt: string;
  timeLabel: string;
}

export interface DashboardConfigSummary {
  latency: {
    enabled: boolean;
    mode: 'fixed' | 'range';
    minMs: number;
    maxMs: number;
  };
  errorSimulation: {
    enabled: boolean;
    ratePct: number;
    codes: number[];
  };
  rateLimiting: {
    enabled: boolean;
    rpm: number;
  };
  logging: {
    level: 'basic' | 'full' | 'off';
  };
  scope: 'all' | 'unset';
}

export interface DashboardProject {
  id: string;
  name: string;
  slug: string;
  status: DashboardProjectStatus;
  mockUrl: string;
  /** Short line for dashboard hero */
  description: string;
  /** Relative time label, e.g. "2 hours ago" */
  lastUpdatedRelative: string;
  metrics: DashboardMetrics;
  health: DashboardHealth;
  endpointRows: DashboardEndpointRow[];
  recentRequests: DashboardRecentRequest[];
  configSummary: DashboardConfigSummary;
  /** Frontend-derived navigation previews built from summary rows, not part of the backend summary contract itself. */
  endpoints: EndpointPreview[];
}
