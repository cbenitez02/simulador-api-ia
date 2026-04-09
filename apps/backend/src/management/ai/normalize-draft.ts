import {
  aiPreviewResponseSchema,
  type AiPreviewResponseInput,
  type AiRawGeneratedEndpointInput,
} from './schema.js';

function normalizePath(path: string): string {
  const trimmed = path.trim();
  const withSlashes = trimmed.replace(/\\+/g, '/').replace(/\/+/g, '/');
  const withoutLeading = withSlashes.replace(/^\/+/, '');

  return `/${withoutLeading}`;
}

function isEmptyBody(body: unknown): boolean {
  if (body == null) {
    return true;
  }

  if (Array.isArray(body)) {
    return body.length === 0;
  }

  if (typeof body === 'object') {
    return Object.keys(body as Record<string, unknown>).length === 0;
  }

  return false;
}

function normalizeScenarioType(
  type: string,
  statusCode: number,
  body: unknown
): 'success' | 'error' | 'timeout' | 'empty' {
  const normalizedType = type.trim().toLowerCase();

  if (normalizedType === 'success') return 'success';
  if (normalizedType === 'error') return 'error';
  if (normalizedType === 'timeout') return 'timeout';
  if (normalizedType === 'empty') return 'empty';
  if (normalizedType === 'edge-case') {
    if (statusCode === 204 || isEmptyBody(body)) {
      return 'empty';
    }

    return statusCode >= 400 ? 'error' : 'success';
  }

  if (statusCode === 204 || isEmptyBody(body)) {
    return 'empty';
  }

  return statusCode >= 400 ? 'error' : 'success';
}

export function normalizeAiDraft(rawDraft: AiRawGeneratedEndpointInput): AiPreviewResponseInput {
  return aiPreviewResponseSchema.parse({
    method: rawDraft.method.trim().toUpperCase(),
    path: normalizePath(rawDraft.path),
    description: rawDraft.description.trim(),
    statusCode: rawDraft.statusCode,
    responseBody: rawDraft.responseBody,
    scenarios: rawDraft.scenarios.map((scenario) => ({
      name: scenario.name.trim(),
      type: normalizeScenarioType(scenario.type, scenario.statusCode, scenario.body),
      statusCode: scenario.statusCode,
      body: scenario.body,
      delayMs: scenario.delayMs,
      weight: scenario.weight,
    })),
    locks: {
      method: true,
      path: true,
      scenarioType: true,
    },
  });
}
