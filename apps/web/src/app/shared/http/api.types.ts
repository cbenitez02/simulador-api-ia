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
