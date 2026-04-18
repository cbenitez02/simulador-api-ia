import type { GlobalConfigDto } from '../../../shared/http/api.types';

export interface ProjectSnapshotActor {
  userId: string;
  email: string | null;
  displayName: string | null;
  label: string;
}

export interface ProjectSnapshotPayloadEndpointConfig {
  latencyMode: 'fixed' | 'range';
  fixedDelayMs: number;
  minDelayMs: number;
  maxDelayMs: number;
  errorRate: number;
  useScenarioWeights: boolean;
}

export interface ProjectSnapshotPayloadScenario {
  name: string;
  type: 'success' | 'error' | 'timeout' | 'empty';
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

export interface ProjectSnapshotPayloadEndpoint {
  method: string;
  path: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  endpointConfig: ProjectSnapshotPayloadEndpointConfig;
  scenarios: ProjectSnapshotPayloadScenario[];
}

export interface ProjectSnapshotPayload {
  project: {
    id: string;
    slug: string;
    name: string;
    description: string;
  };
  globalConfig: GlobalConfigDto;
  endpoints: ProjectSnapshotPayloadEndpoint[];
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: ProjectSnapshotActor;
}

export interface ProjectSnapshotDetail extends ProjectSnapshot {
  payload: ProjectSnapshotPayload;
}

export interface ProjectSnapshotListResult {
  items: ProjectSnapshot[];
}
