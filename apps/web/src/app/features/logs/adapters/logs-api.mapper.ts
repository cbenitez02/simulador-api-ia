import type { ApiLogEntry, ApiLogListResult, LogScenarioKind, ScenarioSelectionSource } from '../models/api-log.model';
import type { ApiLogDto, ApiLogListDto } from '../../../shared/http/api.types';

function normalizeMethod(method: string): ApiLogEntry['method'] {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE' ? method : 'GET';
}

function normalizeScenario(value: string): LogScenarioKind {
  return value === 'success' ||
    value === 'error' ||
    value === 'timeout' ||
    value === 'empty' ||
    value === 'forced-error' ||
    value === 'rate-limit-block'
    ? value
    : 'default';
}

function normalizeSelectionSource(value: string): ScenarioSelectionSource {
  return value === 'weighted-random' || value === 'uniform-random' || value === 'forced-error' || value === 'rate-limit'
    ? value
    : 'direct-endpoint';
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
    origin: log.origin,
    statusCode: log.statusCode,
    latencyMs: log.latencyMs,
    scenario: normalizeScenario(log.scenarioType),
    scenarioSelectionSource: normalizeSelectionSource(log.scenarioSelectionSource),
    scenarioName: log.scenarioName,
    hasScenario: log.hasScenario,
    createdAt: log.createdAt,
    timeLabel: timeLabel(log.createdAt),
    requestHeaders: log.requestHeaders,
    requestBody: log.requestBody,
    responseHeaders: log.responseHeaders,
    responseBody: log.responseBody,
  };
}

export function mapLogListFromApi(logs: ApiLogListDto): ApiLogListResult {
  return {
    items: logs.items.map(mapLogFromApi),
    nextCursor: logs.nextCursor,
    serverTime: logs.serverTime,
  };
}
