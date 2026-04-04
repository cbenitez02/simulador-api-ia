import type { HttpMethod } from '../../../shared/models/endpoint-preview.model';

export type LogScenarioKind = 'success' | 'error' | 'empty';

/** How the mock resolver picked the scenario (drives execution summary copy). */
export type ScenarioSelectionSource = 'default' | 'weighted' | 'alternate';

export interface ApiLogEntry {
  id: string;
  method: HttpMethod;
  path: string;
  fullUrl: string;
  statusCode: number;
  latencyMs: number;
  scenario: LogScenarioKind;
  /** Simulation rule that produced this scenario — used for the execution summary. */
  scenarioSelectionSource: ScenarioSelectionSource;
  timeLabel: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown | null;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
}
