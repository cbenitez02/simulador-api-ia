import type { HttpMethod } from '../../../shared/models/endpoint-preview.model';

export type LogOrigin = 'mock' | 'forced-error';

export type LogScenarioKind =
  | 'success'
  | 'error'
  | 'timeout'
  | 'empty'
  | 'unauthorized'
  | 'forced-error'
  | 'default'
  | 'rate-limit-block';

/** How the mock resolver picked the scenario (drives execution summary copy). */
export type ScenarioSelectionSource =
  | 'weighted-random'
  | 'uniform-random'
  | 'direct-endpoint'
  | 'forced-error'
  | 'rate-limit';

export interface ApiLogCursor {
  createdAt: string;
  id: string;
}

export interface ApiLogEntry {
  id: string;
  method: HttpMethod;
  path: string;
  fullUrl: string;
  origin: LogOrigin;
  statusCode: number;
  latencyMs: number;
  scenario: LogScenarioKind;
  /** Simulation rule that produced this scenario — used for the execution summary. */
  scenarioSelectionSource: ScenarioSelectionSource;
  scenarioName: string | null;
  hasScenario: boolean;
  createdAt: string;
  timeLabel: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown | null;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
}

export interface ApiLogListResult {
  items: ApiLogEntry[];
  nextCursor: ApiLogCursor | null;
  serverTime: string;
}

export interface ListLogsQuery {
  limit?: number;
  direction?: 'older' | 'newer';
  cursorCreatedAt?: string;
  cursorId?: string;
  method?: HttpMethod;
  statusBucket?: '2xx' | '3xx' | '4xx' | '5xx';
  path?: string;
}
