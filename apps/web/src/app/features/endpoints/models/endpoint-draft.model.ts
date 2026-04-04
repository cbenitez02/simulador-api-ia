import type { HttpMethod } from '../../../shared/models/endpoint-preview.model';

/** High-level scenario kind for mock simulation UX. */
export type EndpointScenarioKind = 'success' | 'empty' | 'error' | 'timeout' | 'custom';

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

/** Result of the mock AI generator before merging into `EndpointDraft`. */
export interface AiGeneratedEndpointShape {
  readonly method: HttpMethod;
  readonly route: string;
  readonly description: string;
  readonly responseBody: unknown;
  readonly scenarios: EndpointScenario[];
  readonly statusCode: number;
}
