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
  type: 'success' | 'error' | 'timeout' | 'empty' | 'unauthorized';
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

export interface ProjectSnapshotRevisionMetadata {
  endpointCount: number;
  scenarioCount: number;
  globalScope: 'all' | 'unset' | null;
  projectSlug: string | null;
  projectName: string | null;
  isLegacySnapshot: boolean;
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  revision: ProjectSnapshotRevisionMetadata;
  createdBy: ProjectSnapshotActor;
}

export interface ProjectSnapshotDetail extends ProjectSnapshot {
  payload: ProjectSnapshotPayload;
}

export interface ProjectSnapshotListResult {
  items: ProjectSnapshot[];
}

export interface ProjectSnapshotRestorePreviewValue<T> {
  current: T;
  snapshot: T;
  changed: boolean;
}

export interface ProjectSnapshotRestorePreviewConfigChange {
  field: keyof Omit<GlobalConfigDto, 'projectId'>;
  current: unknown;
  snapshot: unknown;
}

export interface ProjectSnapshotRestorePreviewEndpoint {
  key: string;
  method: string;
  path: string;
}

export interface ProjectSnapshotRestorePreview {
  snapshotId: string;
  snapshotName: string;
  revision: ProjectSnapshotRevisionMetadata;
  project: {
    name: ProjectSnapshotRestorePreviewValue<string>;
    description: ProjectSnapshotRestorePreviewValue<string>;
  };
  globalConfig: {
    changed: boolean;
    changes: ProjectSnapshotRestorePreviewConfigChange[];
  };
  endpoints: {
    create: ProjectSnapshotRestorePreviewEndpoint[];
    update: ProjectSnapshotRestorePreviewEndpoint[];
    delete: ProjectSnapshotRestorePreviewEndpoint[];
    keep: ProjectSnapshotRestorePreviewEndpoint[];
  };
  counts: {
    create: number;
    update: number;
    delete: number;
    keep: number;
    totalAfterRestore: number;
  };
}
