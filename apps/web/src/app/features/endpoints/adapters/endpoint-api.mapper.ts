import type { EndpointPreview, HttpMethod } from '../../../shared/models/endpoint-preview.model';
import type { EndpointConfig } from '../../../shared/models/endpoint-config.model';
import type {
  AiEndpointPreviewDto,
  CreateEndpointDto,
  EndpointConfigDto,
  EndpointDto,
  UpdateEndpointDto,
} from '../../../shared/http/api.types';
import type { EndpointDraft, EndpointScenario } from '../models/endpoint-draft.model';
import { newScenarioId, unlockedEndpointDraftLocks } from '../models/endpoint-draft.model';

const HTTP_METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function normalizeMethod(method: string): HttpMethod {
  return HTTP_METHODS.has(method as HttpMethod) ? (method as HttpMethod) : 'GET';
}

function configToUi(config?: EndpointConfigDto | null): EndpointConfig {
  const resolved = config ?? {
    endpointId: '',
    latencyMode: 'fixed' as const,
    fixedDelayMs: 0,
    minDelayMs: 0,
    maxDelayMs: 500,
    errorRate: 0,
    useScenarioWeights: true,
  };

  return {
    latencyMs:
      resolved.latencyMode === 'range'
        ? Math.round((resolved.minDelayMs + resolved.maxDelayMs) / 2)
        : resolved.fixedDelayMs,
    errorRatePct: Math.round(resolved.errorRate * 100),
    scenarios: { success: true, empty: false, error: false, timeout: false },
  };
}

function scenariosToFlags(scenarios: EndpointScenario[]): EndpointConfig['scenarios'] {
  return {
    success: scenarios.some((scenario) => scenario.type === 'success') || scenarios.length === 0,
    empty: scenarios.some((scenario) => scenario.type === 'empty'),
    error: scenarios.some((scenario) => scenario.type === 'error'),
    timeout: scenarios.some((scenario) => scenario.type === 'timeout'),
  };
}

export function mapEndpointSummaryFromApi(endpoint: EndpointDto): EndpointPreview {
  const method = normalizeMethod(endpoint.method);
  const config = configToUi(endpoint.endpointConfig);
  const scenarios = (endpoint.scenarios ?? []).map(mapScenarioFromApi);

  return {
    id: endpoint.id,
    method,
    path: endpoint.path,
    description: endpoint.description || 'No description',
    latencyMs: config.latencyMs,
    statusCode: endpoint.statusCode,
    responseBody: endpoint.responseBody,
    responseHeaders: { 'content-type': 'application/json' },
    config: { ...config, scenarios: scenarios.length ? scenariosToFlags(scenarios) : config.scenarios },
  };
}

export function mapEndpointDraftFromApi(endpoint: EndpointDto): EndpointDraft {
  const method = normalizeMethod(endpoint.method);
  const config = endpoint.endpointConfig;
  const scenarios = endpoint.scenarios?.length
    ? endpoint.scenarios.map(mapScenarioFromApi)
    : [fallbackSuccessScenario(endpoint)];

  return {
    method,
    route: endpoint.path,
    description: endpoint.description || '',
    statusCode: endpoint.statusCode,
    responseBody: endpoint.responseBody,
    scenarios,
    behavior: {
      latencyMode: config?.latencyMode ?? 'fixed',
      fixedDelayMs: config?.fixedDelayMs ?? 0,
      minDelayMs: config?.minDelayMs ?? 0,
      maxDelayMs: config?.maxDelayMs ?? 500,
      errorRate: Math.round((config?.errorRate ?? 0) * 100),
      useScenarioWeights: config?.useScenarioWeights ?? true,
    },
    locks: unlockedEndpointDraftLocks(),
    source: 'existing',
  };
}

export function mapAiDraftFromApi(draft: AiEndpointPreviewDto): EndpointDraft {
  return {
    method: draft.method,
    route: draft.path,
    description: draft.description,
    statusCode: draft.statusCode,
    responseBody: draft.responseBody,
    scenarios: draft.scenarios.map((scenario) => ({
      id: newScenarioId(),
      name: scenario.name,
      type: scenario.type,
      statusCode: scenario.statusCode,
      body: scenario.body,
      delayMs: scenario.delayMs,
      weight: scenario.weight,
    })),
    behavior: defaultBehaviorFromAiDraft(draft),
    locks: {
      method: draft.locks.method,
      path: draft.locks.path,
      scenarioType: true,
    },
    source: 'ai-preview',
  };
}

function mapScenarioFromApi(scenario: {
  id: string;
  name: string;
  type: 'success' | 'error' | 'timeout' | 'empty';
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}): EndpointScenario {
  return {
    id: scenario.id,
    name: scenario.name,
    type: scenario.type,
    statusCode: scenario.statusCode,
    body: scenario.body,
    delayMs: scenario.delayMs,
    weight: scenario.weight,
  };
}

function fallbackSuccessScenario(endpoint: EndpointDto): EndpointScenario {
  return {
    id: `fallback-${endpoint.id}`,
    name: 'Success',
    type: 'success',
    statusCode: endpoint.statusCode,
    body: endpoint.responseBody,
    delayMs: endpoint.endpointConfig?.fixedDelayMs ?? 0,
    weight: 100,
  };
}

function defaultBehaviorFromAiDraft(draft: AiEndpointPreviewDto): EndpointDraft['behavior'] {
  const highestDelay = draft.scenarios.reduce((max, scenario) => Math.max(max, scenario.delayMs), 0);

  return {
    latencyMode: 'fixed',
    fixedDelayMs: highestDelay,
    minDelayMs: 0,
    maxDelayMs: Math.max(highestDelay, 500),
    errorRate: 0,
    useScenarioWeights: true,
  };
}

export function mapEndpointRequestFromDraft(draft: EndpointDraft): CreateEndpointDto | UpdateEndpointDto {
  return {
    description: draft.description.trim(),
    statusCode: draft.statusCode,
    responseBody: draft.responseBody,
  };
}

export function mapEndpointCreateRequestFromDraft(draft: EndpointDraft): CreateEndpointDto {
  return {
    method: draft.method,
    path: draft.route.startsWith('/') ? draft.route : `/${draft.route}`,
    description: draft.description.trim(),
    statusCode: draft.statusCode,
    responseBody: draft.responseBody,
  };
}

export function mapEndpointConfigRequestFromDraft(endpointId: string, draft: EndpointDraft): EndpointConfigDto {
  return {
    endpointId,
    latencyMode: draft.behavior.latencyMode,
    fixedDelayMs: draft.behavior.fixedDelayMs,
    minDelayMs: draft.behavior.minDelayMs,
    maxDelayMs: draft.behavior.maxDelayMs,
    errorRate: draft.behavior.errorRate / 100,
    useScenarioWeights: draft.behavior.useScenarioWeights,
  };
}
