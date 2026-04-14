import type { DashboardProject } from '../models/dashboard-project.model';
import type { EndpointPreview } from '../../../shared/models/endpoint-preview.model';
import type { DashboardSummaryDto, ProjectDto } from '../../../shared/http/api.types';
import { getMockBaseUrl } from '../../../shared/config/app-runtime-config';
import { formatRelativeTime } from '../../../shared/utils/relative-time';

const HTTP_METHODS = new Set<EndpointPreview['method']>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function buildPlaceholderEndpointPreview(projectId: string, index: number): EndpointPreview {
  return {
    id: `${projectId}-placeholder-${index + 1}`,
    method: 'GET',
    path: `Endpoint ${index + 1}`,
    description: 'Loading endpoint details',
    latencyMs: 0,
    statusCode: 200,
    responseBody: null,
  };
}

function buildPlaceholderEndpointRow(projectId: string, index: number) {
  return {
    endpointId: `${projectId}-placeholder-${index + 1}`,
    method: 'GET' as const,
    path: `Endpoint ${index + 1}`,
    description: 'Loading endpoint details',
    scenarioCount: 0,
    latencyMs: 0,
    errorRatePct: 0,
    status: 'needs-attention' as const,
  };
}

function normalizeMethod(method: string): EndpointPreview['method'] {
  return HTTP_METHODS.has(method as EndpointPreview['method']) ? (method as EndpointPreview['method']) : 'GET';
}

/**
 * Summary rows are dashboard contract data. Previews are a frontend-only derivative kept for
 * workspace navigation until/if a dedicated navigation contract exists.
 */
export function mapDashboardEndpointPreviewFromSummaryRow(
  row: DashboardSummaryDto['endpointRows'][number],
): EndpointPreview {
  return {
    id: row.endpointId,
    method: normalizeMethod(row.method),
    path: row.path,
    description: row.description || 'No description',
    latencyMs: row.latencyMs,
    statusCode: row.errorRatePct > 0 ? 500 : 200,
    responseBody: null,
  };
}

export function mapDashboardProjectFromApi(summary: DashboardSummaryDto): DashboardProject {
  const mockBaseUrl = getMockBaseUrl();

  return {
    id: summary.project.id,
    name: summary.project.name,
    slug: summary.project.slug,
    workspace: summary.project.workspace,
    status: summary.project.status,
    mockUrl: summary.project.mockUrl || `${mockBaseUrl}/${summary.project.slug}`,
    description: summary.project.description || 'Your mock API workspace.',
    lastUpdatedRelative: formatRelativeTime(summary.project.updatedAt),
    metrics: summary.metrics,
    health: summary.health,
    endpointRows: summary.endpointRows.map((row) => ({
      ...row,
      method: normalizeMethod(row.method),
      status: row.status,
    })),
    endpointRowsMeta: {
      total: summary.endpointRowsMeta?.total ?? summary.endpointRows.length,
      limit: summary.endpointRowsMeta?.limit ?? summary.endpointRows.length,
      hasMore: summary.endpointRowsMeta?.hasMore ?? false,
    },
    recentRequests: summary.recentRequests.map((request) => ({
      ...request,
      method: normalizeMethod(request.method),
      timeLabel: formatRelativeTime(request.createdAt),
    })),
    configSummary: summary.configSummary,
    endpoints: summary.endpointRows.map(mapDashboardEndpointPreviewFromSummaryRow),
  };
}

export function mapCreatedProjectPlaceholder(project: ProjectDto): DashboardProject {
  const mockBaseUrl = getMockBaseUrl();
  const placeholderCount = project._count.endpoints;
  const placeholderEndpoints = Array.from({ length: placeholderCount }, (_, index) =>
    buildPlaceholderEndpointPreview(project.id, index),
  );
  const placeholderEndpointRows = Array.from({ length: placeholderCount }, (_, index) =>
    buildPlaceholderEndpointRow(project.id, index),
  );

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    workspace: project.workspace,
    status: 'empty',
    mockUrl: `${mockBaseUrl}/${project.slug}`,
    description: project.description || 'Your mock API workspace.',
    lastUpdatedRelative: formatRelativeTime(project.updatedAt),
    metrics: {
      totalEndpoints: placeholderCount,
      totalScenarios: 0,
      avgLatencyMs: 0,
      errorRatePct: 0,
      totalRequests: 0,
    },
    health: {
      readyEndpoints: 0,
      needsAttentionEndpoints: placeholderCount,
      errorScenarioEndpoints: 0,
      emptyScenarioEndpoints: 0,
      timeoutScenarioEndpoints: 0,
    },
    endpointRows: placeholderEndpointRows,
    endpointRowsMeta: {
      total: placeholderCount,
      limit: placeholderCount,
      hasMore: false,
    },
    recentRequests: [],
    configSummary: {
      latency: { enabled: false, mode: 'fixed', minMs: 0, maxMs: 1000 },
      errorSimulation: { enabled: false, ratePct: 0, codes: [500] },
      rateLimiting: { enabled: false, rpm: 60 },
      logging: { level: 'basic' },
      scope: 'all',
    },
    endpoints: placeholderEndpoints,
  };
}

export function replaceProjectEndpoints(project: DashboardProject, endpoints: EndpointPreview[]): DashboardProject {
  return { ...project, endpoints };
}
