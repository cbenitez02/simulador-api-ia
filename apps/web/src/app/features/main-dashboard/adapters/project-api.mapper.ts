import type { DashboardProject } from '../models/dashboard-project.model';
import type { EndpointPreview } from '../../../shared/models/endpoint-preview.model';
import type { DashboardSummaryDto, ProjectDto } from '../../../shared/http/api.types';
import { getMockBaseUrl } from '../../../shared/config/app-runtime-config';
import { formatRelativeTime } from '../../../shared/utils/relative-time';

const HTTP_METHODS = new Set<EndpointPreview['method']>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

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

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: 'empty',
    mockUrl: `${mockBaseUrl}/${project.slug}`,
    description: project.description || 'Your mock API workspace.',
    lastUpdatedRelative: formatRelativeTime(project.updatedAt),
    metrics: {
      totalEndpoints: 0,
      totalScenarios: 0,
      avgLatencyMs: 0,
      errorRatePct: 0,
      totalRequests: 0,
    },
    health: {
      readyEndpoints: 0,
      needsAttentionEndpoints: 0,
      errorScenarioEndpoints: 0,
      emptyScenarioEndpoints: 0,
      timeoutScenarioEndpoints: 0,
    },
    endpointRows: [],
    recentRequests: [],
    configSummary: {
      latency: { enabled: false, mode: 'fixed', minMs: 0, maxMs: 1000 },
      errorSimulation: { enabled: false, ratePct: 0, codes: [500] },
      rateLimiting: { enabled: false, rpm: 60 },
      logging: { level: 'basic' },
      scope: 'all',
    },
    endpoints: [],
  };
}

export function replaceProjectEndpoints(project: DashboardProject, endpoints: EndpointPreview[]): DashboardProject {
  return { ...project, endpoints };
}
