export interface ApiValidationIssueDto {
  path: string;
  message: string;
}

export interface ApiErrorDto {
  error: string;
  code?: string;
  retryable?: boolean;
  details?: unknown;
}

export type WorkspaceRoleDto = 'owner' | 'editor' | 'viewer';
export type InvitableWorkspaceRoleDto = Exclude<WorkspaceRoleDto, 'owner'>;
export type WorkspaceKindDto = 'personal' | 'team';

export interface WorkspaceCapabilitiesDto {
  canEdit: boolean;
  canManageMembers: boolean;
  canRestoreSnapshots: boolean;
  canImportContracts: boolean;
}

export interface WorkspaceSummaryDto {
  id: string;
  name: string;
  kind: WorkspaceKindDto;
  role: WorkspaceRoleDto;
  isPersonal?: boolean;
  capabilities: WorkspaceCapabilitiesDto;
}

export interface WorkspaceListDto {
  items: WorkspaceSummaryDto[];
}

export interface WorkspaceMemberDto {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: WorkspaceRoleDto;
  createdAt: string;
}

export interface WorkspaceMembersListDto {
  items: WorkspaceMemberDto[];
}

export type WorkspaceInvitationStatusDto = 'pending' | 'accepted' | 'revoked';

export interface WorkspaceInvitationDto {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: WorkspaceRoleDto;
  status: WorkspaceInvitationStatusDto;
  createdAt: string;
}

export interface WorkspaceInvitationsListDto {
  items: WorkspaceInvitationDto[];
}

export interface UpdateWorkspaceMemberRoleDto {
  role: WorkspaceRoleDto;
}

export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  updatedAt: string;
  workspace: WorkspaceSummaryDto;
  _count: { endpoints: number };
}

export interface PageDto {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface PagedResponseDto<T> {
  items: T[];
  page: PageDto;
}

export interface EndpointListItemDto {
  id: string;
  projectId: string;
  method: string;
  path: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  responseHeaders: Record<string, string>;
  updatedAt: string;
  scenarioCount: number;
  latencyMs: number;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  workspaceId?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  slug?: string;
  workspaceId?: string;
}

export interface EndpointConfigDto {
  endpointId: string;
  latencyMode: 'fixed' | 'range';
  fixedDelayMs: number;
  minDelayMs: number;
  maxDelayMs: number;
  errorRate: number;
  useScenarioWeights: boolean;
}

export interface ScenarioDto {
  id: string;
  endpointId: string;
  name: string;
  type: 'success' | 'error' | 'timeout' | 'empty' | 'unauthorized';
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

export interface EndpointDto {
  id: string;
  projectId: string;
  method: string;
  path: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  updatedAt?: string;
  endpointConfig?: EndpointConfigDto | null;
  scenarios?: ScenarioDto[];
  _count?: { scenarios: number };
}

export type AiScenarioTypeDto = 'success' | 'error' | 'timeout' | 'empty' | 'unauthorized';

export interface AiEndpointScenarioDto {
  name: string;
  type: AiScenarioTypeDto;
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

export interface AiEndpointDraftLocksDto {
  method: true;
  path: true;
  scenarioType: true;
}

export interface AiEndpointPreviewDto {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  path: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  scenarios: AiEndpointScenarioDto[];
  locks: AiEndpointDraftLocksDto;
}

export interface CreateEndpointDto {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  path: string;
  description?: string;
  statusCode: number;
  responseBody: unknown;
}

export interface UpdateEndpointDto {
  description?: string;
  statusCode?: number;
  responseBody?: unknown;
}

export interface CreateScenarioDto {
  name: string;
  type: 'success' | 'error' | 'timeout' | 'empty' | 'unauthorized';
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

export type UpdateScenarioDto = Partial<CreateScenarioDto>;

export interface GlobalConfigDto {
  projectId: string;
  latencyEnabled: boolean;
  latencyMinMs: number;
  latencyMaxMs: number;
  latencyMode: 'fixed' | 'range';
  errorSimulationEnabled: boolean;
  errorSimulationRate: number;
  errorSimulationCodes: number[];
  rateLimitingEnabled: boolean;
  rateLimitingRpm: number;
  loggingLevel: 'basic' | 'full' | 'off';
  scope: 'all' | 'unset';
}

export type SaveGlobalConfigDto = Omit<GlobalConfigDto, 'projectId'>;

export interface ProjectSnapshotActorDto {
  userId: string;
  email: string | null;
  displayName: string | null;
}

export interface ProjectSnapshotPayloadEndpointConfigDto {
  latencyMode: 'fixed' | 'range';
  fixedDelayMs: number;
  minDelayMs: number;
  maxDelayMs: number;
  errorRate: number;
  useScenarioWeights: boolean;
}

export interface ProjectSnapshotPayloadScenarioDto {
  name: string;
  type: 'success' | 'error' | 'timeout' | 'empty' | 'unauthorized';
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

export interface ProjectSnapshotPayloadEndpointDto {
  method: string;
  path: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  endpointConfig: ProjectSnapshotPayloadEndpointConfigDto;
  scenarios: ProjectSnapshotPayloadScenarioDto[];
}

export interface ProjectSnapshotPayloadDto {
  project: {
    id: string;
    slug: string;
    name: string;
    description: string;
  };
  globalConfig: GlobalConfigDto;
  endpoints: ProjectSnapshotPayloadEndpointDto[];
}

export interface ProjectSnapshotDto {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  revision?: {
    endpointCount: number;
    scenarioCount: number;
    globalScope: 'all' | 'unset' | null;
    projectSlug: string | null;
    projectName: string | null;
    isLegacySnapshot: boolean;
  };
  createdBy: ProjectSnapshotActorDto;
}

export interface ProjectSnapshotListDto {
  items: ProjectSnapshotDto[];
}

export interface ProjectSnapshotDetailDto extends ProjectSnapshotDto {
  payload: ProjectSnapshotPayloadDto;
}

export interface CreateProjectSnapshotDto {
  name: string;
  description?: string;
}

export interface RestoreProjectSnapshotResponseDto {
  restoredSnapshotId: string;
}

export interface ProjectSnapshotRestorePreviewValueDto<T> {
  current: T;
  snapshot: T;
  changed: boolean;
}

export interface ProjectSnapshotRestorePreviewConfigChangeDto {
  field: keyof Omit<GlobalConfigDto, 'projectId'>;
  current: unknown;
  snapshot: unknown;
}

export interface ProjectSnapshotRestorePreviewEndpointDto {
  key: string;
  method: string;
  path: string;
}

export interface ProjectSnapshotRestorePreviewDto {
  snapshotId: string;
  snapshotName: string;
  revision?: {
    endpointCount: number;
    scenarioCount: number;
    globalScope: 'all' | 'unset' | null;
    projectSlug: string | null;
    projectName: string | null;
    isLegacySnapshot: boolean;
  };
  project: {
    name: ProjectSnapshotRestorePreviewValueDto<string>;
    description: ProjectSnapshotRestorePreviewValueDto<string>;
  };
  globalConfig: {
    changed: boolean;
    changes: ProjectSnapshotRestorePreviewConfigChangeDto[];
  };
  endpoints: {
    create: ProjectSnapshotRestorePreviewEndpointDto[];
    update: ProjectSnapshotRestorePreviewEndpointDto[];
    delete: ProjectSnapshotRestorePreviewEndpointDto[];
    keep: ProjectSnapshotRestorePreviewEndpointDto[];
  };
  counts: {
    create: number;
    update: number;
    delete: number;
    keep: number;
    totalAfterRestore: number;
  };
}

export interface ApiLogDto {
  id: string;
  projectId: string;
  method: string;
  path: string;
  fullUrl: string;
  origin: 'mock' | 'forced-error';
  statusCode: number;
  latencyMs: number;
  scenarioType:
    | 'success'
    | 'error'
    | 'timeout'
    | 'empty'
    | 'unauthorized'
    | 'forced-error'
    | 'default'
    | 'rate-limit-block';
  scenarioSelectionSource: 'weighted-random' | 'uniform-random' | 'direct-endpoint' | 'forced-error' | 'rate-limit';
  scenarioName: string | null;
  hasScenario: boolean;
  requestHeaders: Record<string, string>;
  requestBody: unknown | null;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  createdAt: string;
}

export interface ApiLogCursorDto {
  createdAt: string;
  id: string;
}

export interface ApiLogListDto {
  items: ApiLogDto[];
  nextCursor: ApiLogCursorDto | null;
  serverTime: string;
}

export type OpenApiContractFormatDto = 'json' | 'yaml';

export interface OpenApiContractMessageDto {
  code: string;
  message: string;
  path?: string;
}

export interface OpenApiContractOperationDto {
  method: string;
  path: string;
  action: 'create' | 'update' | 'delete' | 'keep';
  warnings: string[];
}

export interface OpenApiContractAnalyzeDto {
  document: {
    title: string;
    version: string;
    format: OpenApiContractFormatDto;
  };
  summary: {
    create: number;
    update: number;
    delete: number;
    warnings: number;
    errors: number;
  };
  operations: OpenApiContractOperationDto[];
  warnings: OpenApiContractMessageDto[];
  errors: OpenApiContractMessageDto[];
}

export interface OpenApiContractImportDto extends OpenApiContractAnalyzeDto {
  committed: {
    created: number;
    updated: number;
    deleted: number;
  };
}

export type ApiAuditEventResourceTypeDto =
  | 'project'
  | 'endpoint'
  | 'scenario'
  | 'global-config'
  | 'endpoint-config'
  | 'snapshot'
  | 'contract';
export type ApiAuditEventActionDto =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'analyzed'
  | 'exported'
  | 'imported';

export interface ApiAuditActorDto {
  userId: string;
  email: string | null;
  displayName: string | null;
}

export interface ApiAuditEventDto {
  id: string;
  actor: ApiAuditActorDto;
  workspaceId: string;
  projectId: string;
  resourceType: ApiAuditEventResourceTypeDto;
  resourceId: string;
  action: ApiAuditEventActionDto;
  summary: string;
  metadata: unknown;
  createdAt: string;
}

export interface ApiAuditEventListDto {
  items: ApiAuditEventDto[];
  nextCursor: ApiLogCursorDto | null;
  serverTime: string;
}

export type DashboardProjectStatusDto = 'empty' | 'attention' | 'running';
export type DashboardEndpointStatusDto = 'ready' | 'needs-attention';

export interface DashboardSummaryDto {
  project: {
    id: string;
    name: string;
    description: string;
    slug: string;
    mockUrl: string;
    workspace: WorkspaceSummaryDto;
    updatedAt: string;
    status: DashboardProjectStatusDto;
  };
  metrics: {
    totalEndpoints: number;
    totalScenarios: number;
    avgLatencyMs: number;
    errorRatePct: number;
    totalRequests: number;
  };
  health: {
    readyEndpoints: number;
    needsAttentionEndpoints: number;
    errorScenarioEndpoints: number;
    emptyScenarioEndpoints: number;
    timeoutScenarioEndpoints: number;
  };
  endpointRows: Array<{
    endpointId: string;
    method: string;
    path: string;
    description: string;
    scenarioCount: number;
    latencyMs: number;
    errorRatePct: number;
    status: DashboardEndpointStatusDto;
  }>;
  endpointRowsMeta?: {
    total: number;
    limit: number;
    hasMore: boolean;
  };
  recentRequests: Array<{
    id: string;
    method: string;
    path: string;
    statusCode: number;
    latencyMs: number;
    scenarioType: string;
    createdAt: string;
  }>;
  configSummary: {
    latency: {
      enabled: boolean;
      mode: 'fixed' | 'range';
      minMs: number;
      maxMs: number;
    };
    errorSimulation: {
      enabled: boolean;
      ratePct: number;
      codes: number[];
    };
    rateLimiting: {
      enabled: boolean;
      rpm: number;
    };
    logging: {
      level: 'basic' | 'full' | 'off';
    };
    scope: 'all' | 'unset';
  };
}
