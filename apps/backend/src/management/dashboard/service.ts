import { requireWorkspaceAccess } from '../../auth/authorization.js';
import { env } from '../../config/env.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import {
  buildDashboardSummary,
  buildProjectTrafficAggregate,
  type EndpointLogAggregate,
} from './summary.js';
import type { DashboardSummaryDto } from './schema.js';
export {
  buildDashboardSummary,
  buildProjectTrafficAggregate,
  calculateErrorRatePct,
  resolveLatencyFallback,
} from './summary.js';

type EndpointRecord = {
  id: string;
  method: string;
  path: string;
  description: string;
  scenarios: Array<{ id: string; type: string }>;
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
  updatedAt: Date;
  endpoints: EndpointRecord[];
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

function normalizeLatencyMode(value: string): 'fixed' | 'range' {
  return value === 'range' ? 'range' : 'fixed';
}

function normalizeLoggingLevel(value: string): 'basic' | 'full' | 'off' {
  return value === 'full' || value === 'off' ? value : 'basic';
}

function normalizeScope(value: string): 'all' | 'unset' {
  return value === 'unset' ? 'unset' : 'all';
}

function normalizeProjectGlobalConfig(
  config: {
    latencyEnabled: boolean;
    latencyMinMs: number;
    latencyMaxMs: number;
    latencyMode: string;
    errorSimulationEnabled: boolean;
    errorSimulationRate: number;
    errorSimulationCodes: unknown;
    rateLimitingEnabled: boolean;
    rateLimitingRpm: number;
    loggingLevel: string;
    scope: string;
  } | null
): ProjectRecord['globalConfig'] {
  if (!config) {
    return null;
  }

  return {
    latencyEnabled: config.latencyEnabled,
    latencyMinMs: config.latencyMinMs,
    latencyMaxMs: config.latencyMaxMs,
    latencyMode: normalizeLatencyMode(config.latencyMode),
    errorSimulationEnabled: config.errorSimulationEnabled,
    errorSimulationRate: config.errorSimulationRate,
    errorSimulationCodes: Array.isArray(config.errorSimulationCodes)
      ? (config.errorSimulationCodes as number[])
      : [...DEFAULT_GLOBAL_CONFIG_VALUES.errorSimulationCodes],
    rateLimitingEnabled: config.rateLimitingEnabled,
    rateLimitingRpm: config.rateLimitingRpm,
    loggingLevel: normalizeLoggingLevel(config.loggingLevel),
    scope: normalizeScope(config.scope),
  };
}

function normalizeEndpointLogAggregates(
  logRows: Array<{ method: string; path: string; statusCode: number; latencyMs: number }>
): Map<string, EndpointLogAggregate> {
  const aggregates = new Map<string, EndpointLogAggregate>();

  for (const row of logRows) {
    const key = `${row.method} ${row.path}`;
    const current = aggregates.get(key) ?? {
      method: row.method,
      path: row.path,
      totalRequests: 0,
      errorRequests: 0,
      avgLatencyMs: 0,
    };

    const totalRequests = current.totalRequests + 1;
    const totalLatency = current.avgLatencyMs * current.totalRequests + row.latencyMs;

    aggregates.set(key, {
      method: row.method,
      path: row.path,
      totalRequests,
      errorRequests: current.errorRequests + (row.statusCode >= 400 ? 1 : 0),
      avgLatencyMs: Math.round(totalLatency / totalRequests),
    });
  }

  return aggregates;
}

export async function getProjectDashboardSummary(
  actor: AuthenticatedActor,
  projectId: string
): Promise<DashboardSummaryDto> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      endpoints: {
        orderBy: [{ method: 'asc' }, { path: 'asc' }],
        include: {
          scenarios: {
            select: { id: true, type: true },
          },
          endpointConfig: {
            select: {
              latencyMode: true,
              fixedDelayMs: true,
              minDelayMs: true,
              maxDelayMs: true,
            },
          },
        },
      },
      globalConfig: true,
    },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  requireWorkspaceAccess(actor, project.workspaceId);

  const [trafficAggregate, errorRequests, recentLogs, endpointLogs] = await Promise.all([
    prisma.apiLog.aggregate({
      where: { projectId },
      _count: { _all: true },
      _avg: { latencyMs: true },
    }),
    prisma.apiLog.count({
      where: {
        projectId,
        statusCode: { gte: 400 },
      },
    }),
    prisma.apiLog.findMany({
      where: { projectId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 4,
      select: {
        id: true,
        method: true,
        path: true,
        statusCode: true,
        latencyMs: true,
        scenarioType: true,
        createdAt: true,
      },
    }),
    prisma.apiLog.findMany({
      where: { projectId },
      select: {
        method: true,
        path: true,
        statusCode: true,
        latencyMs: true,
      },
    }),
  ]);

  return buildDashboardSummary({
    project: {
      ...project,
      globalConfig: normalizeProjectGlobalConfig(project.globalConfig),
    },
    traffic: buildProjectTrafficAggregate({
      totalRequests: trafficAggregate._count._all,
      avgLatencyMs: trafficAggregate._avg.latencyMs,
      errorRequests,
    }),
    endpointLogs: normalizeEndpointLogAggregates(endpointLogs),
    recentLogs,
    mockBaseUrl: env.MOCK_BASE_URL,
  });
}
