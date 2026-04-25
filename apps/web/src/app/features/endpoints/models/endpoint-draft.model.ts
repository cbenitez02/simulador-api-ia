import type { HttpMethod } from '../../../shared/models/endpoint-preview.model';

/** High-level scenario kind for mock simulation UX. */
export type EndpointScenarioKind = 'success' | 'empty' | 'error' | 'timeout' | 'custom';

export type EndpointDraftSource = 'manual' | 'ai-preview' | 'existing';
export type EndpointFlowMode = 'ai' | 'manual' | 'edit';
export type SaveStage = 'endpoint-core' | 'config' | 'scenarios' | 'refresh';

export interface EndpointDraftLocks {
  method: boolean;
  path: boolean;
  scenarioType: boolean;
}

export type LatencyMode = 'fixed' | 'range';

export interface EndpointScenario {
  readonly id: string;
  name: string;
  type: EndpointScenarioKind;
  statusCode: number;
  body: unknown;
  delayMs: number;
  /** Relative weight when `useScenarioWeights` is enabled (0–100 scale). */
  weight: number;
}

export interface EndpointBehaviorConfig {
  latencyMode: LatencyMode;
  fixedDelayMs: number;
  minDelayMs: number;
  maxDelayMs: number;
  /** Simulated error probability 0–100. */
  errorRate: number;
  useScenarioWeights: boolean;
}

/** Rich draft used in the create flow; map to `EndpointPreview` on save. */
export interface EndpointDraft {
  method: HttpMethod;
  /** Normalized path starting with `/`. */
  route: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  scenarios: EndpointScenario[];
  behavior: EndpointBehaviorConfig;
  locks: EndpointDraftLocks;
  source: EndpointDraftSource;
  saveState?: {
    stage: SaveStage;
    endpointId: string | null;
    partial: boolean;
  } | null;
}

export type CreateEndpointStep = 'prompt' | 'review' | 'editor';

export function defaultEndpointBehavior(): EndpointBehaviorConfig {
  return {
    latencyMode: 'fixed',
    fixedDelayMs: 150,
    minDelayMs: 80,
    maxDelayMs: 400,
    errorRate: 0,
    useScenarioWeights: false,
  };
}

export function newScenarioId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function unlockedEndpointDraftLocks(): EndpointDraftLocks {
  return {
    method: false,
    path: false,
    scenarioType: false,
  };
}

export function endpointDraftLocksForMode(mode: EndpointFlowMode): EndpointDraftLocks {
  if (mode === 'edit') {
    return {
      method: true,
      path: true,
      scenarioType: false,
    };
  }

  return unlockedEndpointDraftLocks();
}

function normalizeDraftRoute(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '/resource';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$|\s+$/g, '') || '/';
}

export function statusCodeForDraftMethod(method: HttpMethod): number {
  if (method === 'POST') return 201;
  if (method === 'DELETE') return 204;
  return 200;
}

export function createManualEndpointDraft(method: HttpMethod = 'GET', route = '/resource'): EndpointDraft {
  const normalizedRoute = normalizeDraftRoute(route);
  const statusCode = statusCodeForDraftMethod(method);

  return {
    method,
    route: normalizedRoute,
    description: '',
    statusCode,
    responseBody: {},
    scenarios: [
      {
        id: newScenarioId(),
        name: 'Success',
        type: 'success',
        statusCode,
        body: {},
        delayMs: 0,
        weight: 100,
      },
    ],
    behavior: defaultEndpointBehavior(),
    locks: endpointDraftLocksForMode('manual'),
    source: 'manual',
    saveState: null,
  };
}

/** Result of the mock AI generator before merging into `EndpointDraft`. */
export interface AiGeneratedEndpointShape {
  readonly method: HttpMethod;
  readonly route: string;
  readonly description: string;
  readonly responseBody: unknown;
  readonly scenarios: EndpointScenario[];
  readonly statusCode: number;
}
