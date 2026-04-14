import { DEFAULT_GLOBAL_CONFIG_VALUES } from '../global-config/defaults.js';
import type { DashboardSummaryDto } from './schema.js';

type EndpointRecord = {
  id: string;
  method: string;
  path: string;
  description: string;
  scenarioCount: number;
  endpointConfig: {
    latencyMode: string;
    fixedDelayMs: number;
    minDelayMs: number;
    maxDelayMs: number;
  } | null;
};

type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  slug: string;
  workspace: DashboardSummaryDto['project']['workspace'];
  updatedAt: Date;
  globalConfig: {
    latencyEnabled: boolean;
    latencyMinMs: number;
    latencyMaxMs: number;
    latencyMode: 'fixed' | 'range';
    errorSimulationEnabled: boolean;
    errorSimulationRate: number;
    errorSimulationCodes: number[];
    rateLimitingEnabled: boolean;
    rateLimitingRpm: number;
    loggingLevel: 'basic' | 'full' | 'off';
    scope: 'all' | 'unset';
  } | null;
};

export type ProjectTrafficAggregate = {
  totalRequests: number;
  avgLatencyMs: number;
  errorRatePct: number;
};

export type EndpointLogAggregate = {
  method: string;
  path: string;
  totalRequests: number;
  errorRequests: number;
  avgLatencyMs: number;
};

export type DashboardHealthSummary = DashboardSummaryDto['health'];

export type DashboardEndpointRowsMeta = DashboardSummaryDto['endpointRowsMeta'];

export type RecentLogRecord = {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  scenarioType: string;
  createdAt: Date;
};

function joinMockProjectUrl(mockBaseUrl: string, projectSlug: string): string {
  return `${mockBaseUrl.replace(/\/$/, '')}/${projectSlug}`;
}

export function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateErrorRatePct(errorCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }

  return roundPercentage((errorCount / totalCount) * 100);
}

export function resolveEndpointStatus(scenarioCount: number): 'ready' | 'needs-attention' {
  return scenarioCount > 0 ? 'ready' : 'needs-attention';
}

export function resolveProjectStatus(
  endpoints: Array<{ status: 'ready' | 'needs-attention' }>
): 'empty' | 'attention' | 'running' {
  if (endpoints.length === 0) {
    return 'empty';
  }

  return endpoints.some((endpoint) => endpoint.status === 'needs-attention')
    ? 'attention'
    : 'running';
}

export function buildHealthBuckets(
  endpoints: Array<{ status: 'ready' | 'needs-attention'; scenarioTypes: string[] }>
): DashboardSummaryDto['health'] {
  return endpoints.reduce<DashboardSummaryDto['health']>(
    (health, endpoint) => ({
      readyEndpoints: health.readyEndpoints + (endpoint.status === 'ready' ? 1 : 0),
      needsAttentionEndpoints:
        health.needsAttentionEndpoints + (endpoint.status === 'needs-attention' ? 1 : 0),
      errorScenarioEndpoints:
        health.errorScenarioEndpoints + (endpoint.scenarioTypes.includes('error') ? 1 : 0),
      emptyScenarioEndpoints:
        health.emptyScenarioEndpoints + (endpoint.scenarioTypes.includes('empty') ? 1 : 0),
      timeoutScenarioEndpoints:
        health.timeoutScenarioEndpoints + (endpoint.scenarioTypes.includes('timeout') ? 1 : 0),
    }),
    {
      readyEndpoints: 0,
      needsAttentionEndpoints: 0,
      errorScenarioEndpoints: 0,
      emptyScenarioEndpoints: 0,
      timeoutScenarioEndpoints: 0,
    }
  );
}

export function resolveLatencyFallback(endpointConfig: EndpointRecord['endpointConfig']): number {
  if (!endpointConfig) {
    return 0;
  }

  if (endpointConfig.latencyMode === 'range') {
    return Math.round((endpointConfig.minDelayMs + endpointConfig.maxDelayMs) / 2);
  }

  return endpointConfig.fixedDelayMs;
}

export function buildProjectTrafficAggregate(input: {
  totalRequests: number;
  avgLatencyMs: number | null;
  errorRequests: number;
}): ProjectTrafficAggregate {
  return {
    totalRequests: input.totalRequests,
    avgLatencyMs: input.avgLatencyMs === null ? 0 : Math.round(input.avgLatencyMs),
    errorRatePct: calculateErrorRatePct(input.errorRequests, input.totalRequests),
  };
}

export function buildDashboardSummary(input: {
  project: ProjectRecord;
  endpointRows: EndpointRecord[];
  endpointRowsMeta: DashboardEndpointRowsMeta;
  traffic: ProjectTrafficAggregate;
  totalScenarios: number;
  health: DashboardHealthSummary;
  projectStatus: DashboardSummaryDto['project']['status'];
  endpointLogs: Map<string, EndpointLogAggregate>;
  recentLogs: RecentLogRecord[];
  mockBaseUrl: string;
}): DashboardSummaryDto {
  const projectConfig = input.project.globalConfig ?? DEFAULT_GLOBAL_CONFIG_VALUES;

  const endpointRows = input.endpointRows.map((endpoint) => {
    const status = resolveEndpointStatus(endpoint.scenarioCount);
    const logAggregate = input.endpointLogs.get(`${endpoint.method} ${endpoint.path}`);

    return {
      endpointId: endpoint.id,
      method: endpoint.method,
      path: endpoint.path,
      description: endpoint.description,
      scenarioCount: endpoint.scenarioCount,
      latencyMs: logAggregate?.avgLatencyMs ?? resolveLatencyFallback(endpoint.endpointConfig),
      errorRatePct: calculateErrorRatePct(
        logAggregate?.errorRequests ?? 0,
        logAggregate?.totalRequests ?? 0
      ),
      status,
    };
  });

  return {
    project: {
      id: input.project.id,
      name: input.project.name,
      description: input.project.description,
      slug: input.project.slug,
      mockUrl: joinMockProjectUrl(input.mockBaseUrl, input.project.slug),
      workspace: input.project.workspace,
      updatedAt: input.project.updatedAt.toISOString(),
      status: input.projectStatus,
    },
    metrics: {
      totalEndpoints: input.endpointRowsMeta.total,
      totalScenarios: input.totalScenarios,
      avgLatencyMs: input.traffic.avgLatencyMs,
      errorRatePct: input.traffic.errorRatePct,
      totalRequests: input.traffic.totalRequests,
    },
    health: input.health,
    endpointRows,
    endpointRowsMeta: input.endpointRowsMeta,
    recentRequests: input.recentLogs.map((log) => ({
      id: log.id,
      method: log.method,
      path: log.path,
      statusCode: log.statusCode,
      latencyMs: log.latencyMs,
      scenarioType: log.scenarioType,
      createdAt: log.createdAt.toISOString(),
    })),
    configSummary: {
      latency: {
        enabled: projectConfig.latencyEnabled,
        mode: projectConfig.latencyMode,
        minMs: projectConfig.latencyMinMs,
        maxMs: projectConfig.latencyMaxMs,
      },
      errorSimulation: {
        enabled: projectConfig.errorSimulationEnabled,
        ratePct: roundPercentage(projectConfig.errorSimulationRate * 100),
        codes: projectConfig.errorSimulationCodes,
      },
      rateLimiting: {
        enabled: projectConfig.rateLimitingEnabled,
        rpm: projectConfig.rateLimitingRpm,
      },
      logging: {
        level: projectConfig.loggingLevel,
      },
      scope: projectConfig.scope,
    },
  };
}
