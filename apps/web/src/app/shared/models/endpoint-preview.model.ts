import type { EndpointConfig } from './endpoint-config.model';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface EndpointPreview {
  id: string;
  method: HttpMethod;
  path: string;
  description: string;
  latencyMs: number;
  statusCode: number;
  responseBody: unknown;
  responseHeaders?: Record<string, string>;
  /** Optional simulator knobs (latency may mirror `latencyMs` when set from the create flow). */
  config?: EndpointConfig;
}
