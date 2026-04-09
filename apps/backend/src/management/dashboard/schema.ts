import { z } from 'zod';

export const dashboardProjectStatusSchema = z.enum(['empty', 'attention', 'running']);
export const dashboardEndpointStatusSchema = z.enum(['ready', 'needs-attention']);
export const dashboardScenarioTypeSchema = z.enum(['success', 'error', 'timeout', 'empty']);
export const dashboardLatencyModeSchema = z.enum(['fixed', 'range']);
export const dashboardLoggingLevelSchema = z.enum(['basic', 'full', 'off']);
export const dashboardScopeSchema = z.enum(['all', 'unset']);

export const dashboardProjectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const dashboardSummarySchema = z.object({
  project: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    slug: z.string(),
    mockUrl: z.string(),
    updatedAt: z.string().datetime(),
    status: dashboardProjectStatusSchema,
  }),
  metrics: z.object({
    totalEndpoints: z.number().int().min(0),
    totalScenarios: z.number().int().min(0),
    avgLatencyMs: z.number().int().min(0),
    errorRatePct: z.number().min(0),
    totalRequests: z.number().int().min(0),
  }),
  health: z.object({
    readyEndpoints: z.number().int().min(0),
    needsAttentionEndpoints: z.number().int().min(0),
    errorScenarioEndpoints: z.number().int().min(0),
    emptyScenarioEndpoints: z.number().int().min(0),
    timeoutScenarioEndpoints: z.number().int().min(0),
  }),
  endpointRows: z.array(
    z.object({
      endpointId: z.string(),
      method: z.string(),
      path: z.string(),
      description: z.string(),
      scenarioCount: z.number().int().min(0),
      latencyMs: z.number().int().min(0),
      errorRatePct: z.number().min(0),
      status: dashboardEndpointStatusSchema,
    })
  ),
  recentRequests: z.array(
    z.object({
      id: z.string(),
      method: z.string(),
      path: z.string(),
      statusCode: z.number().int(),
      latencyMs: z.number().int().min(0),
      scenarioType: z.string(),
      createdAt: z.string().datetime(),
    })
  ),
  configSummary: z.object({
    latency: z.object({
      enabled: z.boolean(),
      mode: dashboardLatencyModeSchema,
      minMs: z.number().int().min(0),
      maxMs: z.number().int().min(0),
    }),
    errorSimulation: z.object({
      enabled: z.boolean(),
      ratePct: z.number().min(0),
      codes: z.array(z.number().int()),
    }),
    rateLimiting: z.object({
      enabled: z.boolean(),
      rpm: z.number().int().min(1),
    }),
    logging: z.object({
      level: dashboardLoggingLevelSchema,
    }),
    scope: dashboardScopeSchema,
  }),
});

export type DashboardProjectParams = z.infer<typeof dashboardProjectParamsSchema>;
export type DashboardSummaryDto = z.infer<typeof dashboardSummarySchema>;
