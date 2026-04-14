export interface ApiValidationIssueDto {
  path: string;
  message: string;
}

export interface ApiErrorDto {
  error: string;
  code?: string;
  retryable?: boolean;
  details?: unknown;
}

export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  updatedAt: string;
  _count: { endpoints: number };
}

export interface PageDto {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface PagedResponseDto<T> {
  items: T[];
  page: PageDto;
}

export interface EndpointListItemDto {
  id: string;
  projectId: string;
  method: string;
  path: string;
  description: string;
  statusCode: number;
  updatedAt: string;
  scenarioCount: number;
  latencyMs: number;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
}

export interface EndpointConfigDto {
  endpointId: string;
  latencyMode: 'fixed' | 'range';
  fixedDelayMs: number;
  minDelayMs: number;
  maxDelayMs: number;
  errorRate: number;
  useScenarioWeights: boolean;
}

export interface ScenarioDto {
  id: string;
  endpointId: string;
  name: string;
  type: 'success' | 'error' | 'timeout' | 'empty';
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

export interface EndpointDto {
  id: string;
  projectId: string;
  method: string;
  path: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  updatedAt?: string;
  endpointConfig?: EndpointConfigDto | null;
  scenarios?: ScenarioDto[];
  _count?: { scenarios: number };
}

export type AiScenarioTypeDto = 'success' | 'error' | 'timeout' | 'empty';

export interface AiEndpointScenarioDto {
  name: string;
  type: AiScenarioTypeDto;
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

export interface AiEndpointDraftLocksDto {
  method: true;
  path: true;
  scenarioType: true;
}

export interface AiEndpointPreviewDto {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  scenarios: AiEndpointScenarioDto[];
  locks: AiEndpointDraftLocksDto;
}

export interface CreateEndpointDto {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description?: string;
  statusCode: number;
  responseBody: unknown;
}

export interface UpdateEndpointDto {
  description?: string;
  statusCode?: number;
  responseBody?: unknown;
}

export interface CreateScenarioDto {
  name: string;
  type: 'success' | 'error' | 'timeout' | 'empty';
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

export type UpdateScenarioDto = Partial<CreateScenarioDto>;

export interface GlobalConfigDto {
  projectId: string;
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
}

export type SaveGlobalConfigDto = Omit<GlobalConfigDto, 'projectId'>;

export interface ApiLogDto {
  id: string;
  projectId: string;
  method: string;
  path: string;
  fullUrl: string;
  origin: 'mock' | 'forced-error';
  statusCode: number;
  latencyMs: number;
  scenarioType: 'success' | 'error' | 'timeout' | 'empty' | 'forced-error' | 'default' | 'rate-limit-block';
  scenarioSelectionSource: 'weighted-random' | 'uniform-random' | 'direct-endpoint' | 'forced-error' | 'rate-limit';
  scenarioName: string | null;
  hasScenario: boolean;
  requestHeaders: Record<string, string>;
  requestBody: unknown | null;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  createdAt: string;
}

export interface ApiLogCursorDto {
  createdAt: string;
  id: string;
}

export interface ApiLogListDto {
  items: ApiLogDto[];
  nextCursor: ApiLogCursorDto | null;
  serverTime: string;
}

export type DashboardProjectStatusDto = 'empty' | 'attention' | 'running';
export type DashboardEndpointStatusDto = 'ready' | 'needs-attention';

export interface DashboardSummaryDto {
  project: {
    id: string;
    name: string;
    description: string;
    slug: string;
    mockUrl: string;
    updatedAt: string;
    status: DashboardProjectStatusDto;
  };
  metrics: {
    totalEndpoints: number;
    totalScenarios: number;
    avgLatencyMs: number;
    errorRatePct: number;
    totalRequests: number;
  };
  health: {
    readyEndpoints: number;
    needsAttentionEndpoints: number;
    errorScenarioEndpoints: number;
    emptyScenarioEndpoints: number;
    timeoutScenarioEndpoints: number;
  };
  endpointRows: Array<{
    endpointId: string;
    method: string;
    path: string;
    description: string;
    scenarioCount: number;
    latencyMs: number;
    errorRatePct: number;
    status: DashboardEndpointStatusDto;
  }>;
  recentRequests: Array<{
    id: string;
    method: string;
    path: string;
    statusCode: number;
    latencyMs: number;
    scenarioType: string;
    createdAt: string;
  }>;
  configSummary: {
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
  };
}
