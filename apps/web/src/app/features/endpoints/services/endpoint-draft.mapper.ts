import type { EndpointConfig } from '../../../shared/models/endpoint-config.model';
import type { MockScenarioId } from '../../../shared/models/mock-scenario.model';
import type { EndpointPreview, HttpMethod } from '../../../shared/models/endpoint-preview.model';
import type {
  AiGeneratedEndpointShape,
  EndpointBehaviorConfig,
  EndpointDraft,
  EndpointScenario,
} from '../models/endpoint-draft.model';
import { defaultEndpointBehavior, newScenarioId } from '../models/endpoint-draft.model';

function normalizeRoute(raw: string): string {
  const t = raw.trim();
  if (!t) return '/resource';
  return t.startsWith('/') ? t : `/${t}`;
}

function latencyFromBehavior(b: EndpointBehaviorConfig): number {
  if (b.latencyMode === 'fixed') return Math.max(0, b.fixedDelayMs);
  const min = Math.max(0, b.minDelayMs);
  const max = Math.max(min, b.maxDelayMs);
  return Math.round((min + max) / 2);
}

function scenarioBooleans(scenarios: readonly EndpointScenario[]): Record<MockScenarioId, boolean> {
  const has = (k: EndpointScenario['type']) => scenarios.some((s) => s.type === k);
  return {
    success: has('success') || scenarios.length === 0,
    empty: has('empty'),
    error: has('error'),
    timeout: has('timeout'),
  };
}

function defaultScenarioBodies(mainBody: unknown, method: HttpMethod): Record<MockScenarioId, unknown> {
  return {
    success: mainBody,
    empty: method === 'DELETE' ? null : {},
    error: { error: 'Internal server error', code: 'ERR_MOCK' },
    timeout: { error: 'Gateway timeout', code: 'TIMEOUT' },
  };
}

function rebuildScenariosFromBooleans(
  scenarios: Record<MockScenarioId, boolean>,
  bodies: Record<MockScenarioId, unknown>,
  latencyMs: number,
): EndpointScenario[] {
  const rows: EndpointScenario[] = [];
  const weights: Record<MockScenarioId, number> = {
    success: 70,
    empty: 15,
    error: 10,
    timeout: 5,
  };
  const codes: Record<MockScenarioId, number> = {
    success: 200,
    empty: 200,
    error: 500,
    timeout: 408,
  };
  const names: Record<MockScenarioId, string> = {
    success: 'Success',
    empty: 'Empty',
    error: 'Error',
    timeout: 'Timeout',
  };

  (['success', 'empty', 'error', 'timeout'] as const).forEach((id) => {
    if (!scenarios[id]) return;
    rows.push({
      id: newScenarioId(),
      name: names[id],
      type: id,
      statusCode: codes[id],
      body: bodies[id],
      delayMs: id === 'timeout' ? Math.max(latencyMs, 5000) : latencyMs,
      weight: weights[id],
    });
  });

  return rows.length ? rows : [fallbackSuccessRow(bodies.success, latencyMs)];
}

function fallbackSuccessRow(body: unknown, latencyMs: number): EndpointScenario {
  return {
    id: newScenarioId(),
    name: 'Success',
    type: 'success',
    statusCode: 200,
    body,
    delayMs: latencyMs,
    weight: 100,
  };
}

function behaviorFromConfig(cfg: EndpointConfig | undefined, fallbackLatency: number): EndpointBehaviorConfig {
  const b = defaultEndpointBehavior();
  if (!cfg) {
    b.fixedDelayMs = fallbackLatency;
    return b;
  }
  b.latencyMode = 'fixed';
  b.fixedDelayMs = cfg.latencyMs;
  b.errorRate = cfg.errorRatePct;
  return b;
}

/** Build a draft from a saved endpoint (edit mode). */
export function endpointPreviewToDraft(ep: EndpointPreview): EndpointDraft {
  const route = normalizeRoute(ep.path);
  const behavior = behaviorFromConfig(ep.config, ep.latencyMs);
  const cfgScenarios = ep.config?.scenarios;
  const bodies = defaultScenarioBodies(ep.responseBody, ep.method);

  const scenarios = cfgScenarios
    ? rebuildScenariosFromBooleans(cfgScenarios, bodies, behavior.fixedDelayMs)
    : [fallbackSuccessRow(ep.responseBody, behavior.fixedDelayMs)];

  return {
    method: ep.method,
    route,
    description: ep.description,
    statusCode: ep.statusCode,
    responseBody: ep.responseBody,
    scenarios,
    behavior,
  };
}

/** Map draft to the existing preview shape for the list/detail/save pipeline. */
export function draftToEndpointPreview(draft: EndpointDraft, existingId?: string): EndpointPreview {
  const id = existingId ?? newEndpointId();
  const latencyMs = latencyFromBehavior(draft.behavior);
  const scenarios = scenarioBooleans(draft.scenarios);

  const config: EndpointConfig = {
    latencyMs,
    errorRatePct: Math.min(100, Math.max(0, draft.behavior.errorRate)),
    scenarios,
  };

  return {
    id,
    method: draft.method,
    path: normalizeRoute(draft.route),
    description: draft.description.trim() || 'No description',
    latencyMs,
    statusCode: draft.statusCode,
    responseBody: draft.responseBody,
    responseHeaders: { 'content-type': 'application/json' },
    config,
  };
}

function newEndpointId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `ep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function statusCodeForMethod(method: HttpMethod): number {
  if (method === 'POST') return 201;
  if (method === 'DELETE') return 204;
  return 200;
}

export function aiShapeToDraft(shape: AiGeneratedEndpointShape): EndpointDraft {
  return {
    method: shape.method,
    route: shape.route,
    description: shape.description,
    statusCode: shape.statusCode,
    responseBody: shape.responseBody,
    scenarios: shape.scenarios.map((s) => ({ ...s })),
    behavior: defaultEndpointBehavior(),
  };
}
