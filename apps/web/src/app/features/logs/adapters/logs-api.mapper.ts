import type { ApiLogEntry, LogScenarioKind, ScenarioSelectionSource } from '../models/api-log.model';
import type { ApiLogDto } from '../../../shared/http/api.types';

function normalizeMethod(method: string): ApiLogEntry['method'] {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE' ? method : 'GET';
}

function normalizeScenario(value: string): LogScenarioKind {
  return value === 'empty' ? 'empty' : value === 'success' ? 'success' : 'error';
}

function normalizeSelectionSource(value: string): ScenarioSelectionSource {
  return value === 'weighted' || value === 'alternate' ? value : 'default';
}

function timeLabel(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('en-GB', { hour12: false });
}

export function mapLogFromApi(log: ApiLogDto): ApiLogEntry {
  return {
    id: log.id,
    method: normalizeMethod(log.method),
    path: log.path,
    fullUrl: log.fullUrl,
    statusCode: log.statusCode,
    latencyMs: log.latencyMs,
    scenario: normalizeScenario(log.scenarioType),
    scenarioSelectionSource: normalizeSelectionSource(log.scenarioSelectionSource),
    timeLabel: timeLabel(log.createdAt),
    requestHeaders: log.requestHeaders,
    requestBody: log.requestBody,
    responseHeaders: log.responseHeaders,
    responseBody: log.responseBody,
  };
}
