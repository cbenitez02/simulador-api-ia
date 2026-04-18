import { authorizeProjectAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { toPrismaJson } from '../../lib/prisma-json.js';
import { AppError } from '../../middleware/error-handler.js';
import { writeAuditEvent } from '../audit-events/service.js';
import { buildDefaultGlobalConfig } from '../global-config/defaults.js';
import type { UpsertGlobalConfigInput } from '../global-config/schema.js';
import type { CreateProjectSnapshotInput } from './schema.js';

interface SnapshotEndpointConfigPayload {
  latencyMode: 'fixed' | 'range';
  fixedDelayMs: number;
  minDelayMs: number;
  maxDelayMs: number;
  errorRate: number;
  useScenarioWeights: boolean;
}

interface SnapshotEndpointConfigSource {
  latencyMode?: unknown;
  fixedDelayMs?: unknown;
  minDelayMs?: unknown;
  maxDelayMs?: unknown;
  errorRate?: unknown;
  useScenarioWeights?: unknown;
}

interface SnapshotScenarioSource {
  name: string;
  type: unknown;
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

interface SnapshotScenarioPayload {
  name: string;
  type: 'success' | 'error' | 'timeout' | 'empty';
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

interface SnapshotEndpointPayload {
  method: string;
  path: string;
  description: string;
  statusCode: number;
  responseBody: unknown;
  endpointConfig: SnapshotEndpointConfigPayload;
  scenarios: SnapshotScenarioPayload[];
}

type SnapshotGlobalConfigPayload = UpsertGlobalConfigInput & { projectId: string };

export interface ProjectSnapshotPayload {
  project: {
    id: string;
    slug: string;
    name: string;
    description: string;
  };
  globalConfig: SnapshotGlobalConfigPayload;
  endpoints: SnapshotEndpointPayload[];
}

interface SnapshotGlobalConfigSource {
  latencyEnabled?: unknown;
  latencyMinMs?: unknown;
  latencyMaxMs?: unknown;
  latencyMode?: unknown;
  errorSimulationEnabled?: unknown;
  errorSimulationRate?: unknown;
  errorSimulationCodes?: unknown;
  rateLimitingEnabled?: unknown;
  rateLimitingRpm?: unknown;
  loggingLevel?: unknown;
  scope?: unknown;
}

interface ProjectSnapshotSummary {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: {
    userId: string;
    email: string | null;
    displayName: string | null;
  };
}

interface ProjectSnapshotDetail extends ProjectSnapshotSummary {
  payload: ProjectSnapshotPayload;
}

interface ProjectSnapshotRecord {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdByUserId: string;
  createdByEmail: string | null;
  createdByDisplayName: string | null;
  payload?: unknown;
  createdAt: Date;
}

const DEFAULT_ENDPOINT_CONFIG: SnapshotEndpointConfigPayload = {
  latencyMode: 'fixed',
  fixedDelayMs: 0,
  minDelayMs: 0,
  maxDelayMs: 500,
  errorRate: 0,
  useScenarioWeights: true,
};

export function buildSnapshotEndpointKey(method: string, path: string): string {
  return `${method.trim().toUpperCase()} ${path.trim()}`;
}

export function planSnapshotEndpointReconciliation(
  snapshotEndpoints: Array<{ method: string; path: string }>,
  liveEndpoints: Array<{ id: string; method: string; path: string }>
) {
  const snapshotByKey = new Map(
    snapshotEndpoints.map((endpoint) => [
      buildSnapshotEndpointKey(endpoint.method, endpoint.path),
      endpoint,
    ])
  );
  const liveByKey = new Map(
    liveEndpoints.map((endpoint) => [
      buildSnapshotEndpointKey(endpoint.method, endpoint.path),
      endpoint,
    ])
  );

  return {
    keep: [...snapshotByKey.keys()]
      .filter((key) => liveByKey.has(key))
      .map((key) => ({ key, live: liveByKey.get(key)! })),
    create: snapshotEndpoints.filter(
      (endpoint) => !liveByKey.has(buildSnapshotEndpointKey(endpoint.method, endpoint.path))
    ),
    deleteIds: liveEndpoints
      .filter(
        (endpoint) => !snapshotByKey.has(buildSnapshotEndpointKey(endpoint.method, endpoint.path))
      )
      .map((endpoint) => endpoint.id),
  };
}

function normalizeEndpointConfig(
  config: SnapshotEndpointConfigSource | null | undefined
): SnapshotEndpointConfigPayload {
  return {
    latencyMode: config?.latencyMode === 'range' ? 'range' : 'fixed',
    fixedDelayMs:
      typeof config?.fixedDelayMs === 'number'
        ? config.fixedDelayMs
        : DEFAULT_ENDPOINT_CONFIG.fixedDelayMs,
    minDelayMs:
      typeof config?.minDelayMs === 'number'
        ? config.minDelayMs
        : DEFAULT_ENDPOINT_CONFIG.minDelayMs,
    maxDelayMs:
      typeof config?.maxDelayMs === 'number'
        ? config.maxDelayMs
        : DEFAULT_ENDPOINT_CONFIG.maxDelayMs,
    errorRate: 0,
    useScenarioWeights:
      typeof config?.useScenarioWeights === 'boolean'
        ? config.useScenarioWeights
        : DEFAULT_ENDPOINT_CONFIG.useScenarioWeights,
  };
}

function toSnapshotSummary(snapshot: ProjectSnapshotRecord): ProjectSnapshotSummary {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    name: snapshot.name,
    description: snapshot.description,
    createdAt: snapshot.createdAt.toISOString(),
    createdBy: {
      userId: snapshot.createdByUserId,
      email: snapshot.createdByEmail,
      displayName: snapshot.createdByDisplayName,
    },
  };
}

function toSnapshotDetail(snapshot: ProjectSnapshotRecord): ProjectSnapshotDetail {
  if (!snapshot.payload) {
    throw new AppError(500, 'Snapshot payload is missing');
  }

  return {
    ...toSnapshotSummary(snapshot),
    payload: snapshot.payload as ProjectSnapshotPayload,
  };
}

function normalizeSnapshotGlobalConfig(
  projectId: string,
  config: SnapshotGlobalConfigSource | null | undefined
): SnapshotGlobalConfigPayload {
  const defaults = buildDefaultGlobalConfig(projectId);

  return {
    projectId,
    latencyEnabled:
      typeof config?.latencyEnabled === 'boolean' ? config.latencyEnabled : defaults.latencyEnabled,
    latencyMinMs:
      typeof config?.latencyMinMs === 'number' ? config.latencyMinMs : defaults.latencyMinMs,
    latencyMaxMs:
      typeof config?.latencyMaxMs === 'number' ? config.latencyMaxMs : defaults.latencyMaxMs,
    latencyMode: config?.latencyMode === 'range' ? 'range' : 'fixed',
    errorSimulationEnabled:
      typeof config?.errorSimulationEnabled === 'boolean'
        ? config.errorSimulationEnabled
        : defaults.errorSimulationEnabled,
    errorSimulationRate:
      typeof config?.errorSimulationRate === 'number'
        ? config.errorSimulationRate
        : defaults.errorSimulationRate,
    errorSimulationCodes: Array.isArray(config?.errorSimulationCodes)
      ? config.errorSimulationCodes.filter((code): code is number => typeof code === 'number')
      : defaults.errorSimulationCodes,
    rateLimitingEnabled:
      typeof config?.rateLimitingEnabled === 'boolean'
        ? config.rateLimitingEnabled
        : defaults.rateLimitingEnabled,
    rateLimitingRpm:
      typeof config?.rateLimitingRpm === 'number'
        ? config.rateLimitingRpm
        : defaults.rateLimitingRpm,
    loggingLevel:
      config?.loggingLevel === 'full' || config?.loggingLevel === 'off'
        ? config.loggingLevel
        : defaults.loggingLevel,
    scope: config?.scope === 'unset' ? 'unset' : 'all',
  };
}

export function buildSnapshotPayload(project: {
  id: string;
  slug: string;
  name: string;
  description: string;
  globalConfig: SnapshotGlobalConfigSource | null;
  endpoints: Array<{
    method: string;
    path: string;
    description: string;
    statusCode: number;
    responseBody: unknown;
    endpointConfig: SnapshotEndpointConfigSource | null;
    scenarios: Array<SnapshotScenarioSource>;
  }>;
}): ProjectSnapshotPayload {
  return {
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
    },
    globalConfig: normalizeSnapshotGlobalConfig(project.id, project.globalConfig),
    endpoints: [...project.endpoints]
      .sort((left, right) =>
        buildSnapshotEndpointKey(left.method, left.path).localeCompare(
          buildSnapshotEndpointKey(right.method, right.path)
        )
      )
      .map((endpoint) => ({
        method: endpoint.method.toUpperCase(),
        path: endpoint.path,
        description: endpoint.description,
        statusCode: endpoint.statusCode,
        responseBody: endpoint.responseBody,
        endpointConfig: normalizeEndpointConfig(endpoint.endpointConfig),
        scenarios: endpoint.scenarios.map((scenario) => ({
          name: scenario.name,
          type:
            scenario.type === 'error' || scenario.type === 'timeout' || scenario.type === 'empty'
              ? scenario.type
              : 'success',
          statusCode: scenario.statusCode,
          body: scenario.body,
          delayMs: scenario.delayMs,
          weight: scenario.weight,
        })),
      })),
  };
}

async function loadSnapshotRecord(
  projectId: string,
  snapshotId: string
): Promise<ProjectSnapshotRecord> {
  const snapshot = await prisma.projectSnapshot.findFirst({
    where: { id: snapshotId, projectId },
  });

  if (!snapshot) {
    throw new AppError(404, 'Snapshot not found');
  }

  return snapshot as ProjectSnapshotRecord;
}

export async function listProjectSnapshots(actor: AuthenticatedActor, projectId: string) {
  await authorizeProjectAccess(actor, projectId, 'read');

  const snapshots = await prisma.projectSnapshot.findMany({
    where: { projectId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  return {
    items: (snapshots as ProjectSnapshotRecord[]).map(toSnapshotSummary),
  };
}

export async function getProjectSnapshotDetail(
  actor: AuthenticatedActor,
  projectId: string,
  snapshotId: string
) {
  await authorizeProjectAccess(actor, projectId, 'read');
  const snapshot = await loadSnapshotRecord(projectId, snapshotId);
  return toSnapshotDetail(snapshot);
}

export async function createProjectSnapshot(
  actor: AuthenticatedActor,
  projectId: string,
  input: CreateProjectSnapshotInput
) {
  const projectAccess = await authorizeProjectAccess(actor, projectId, 'mutate');

  return prisma.$transaction(async (tx) => {
    const creatorProfile = await tx.user.findUnique({
      where: { id: actor.userId },
      select: { email: true, displayName: true },
    });
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        globalConfig: true,
        endpoints: {
          include: {
            endpointConfig: true,
            scenarios: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
          },
          orderBy: [{ method: 'asc' }, { path: 'asc' }, { id: 'asc' }],
        },
      },
    });

    const payload = buildSnapshotPayload(project);
    const snapshot = (await tx.projectSnapshot.create({
      data: {
        projectId,
        name: input.name,
        description: input.description ?? '',
        createdByUserId: actor.userId,
        createdByEmail: creatorProfile?.email ?? null,
        createdByDisplayName: creatorProfile?.displayName ?? null,
        payload: toPrismaJson(payload),
      },
    })) as ProjectSnapshotRecord;

    await writeAuditEvent(tx, {
      actor,
      workspaceId: projectAccess.workspaceId ?? '',
      projectId,
      resourceType: 'snapshot',
      resourceId: snapshot.id,
      action: 'created',
      summary: `Created snapshot ${snapshot.name}`,
      metadata: {
        snapshotName: snapshot.name,
        endpointCount: payload.endpoints.length,
      },
    });

    return toSnapshotSummary(snapshot);
  });
}

export async function restoreProjectSnapshot(
  actor: AuthenticatedActor,
  projectId: string,
  snapshotId: string
) {
  const projectAccess = await authorizeProjectAccess(actor, projectId, 'mutate');
  const snapshot = await loadSnapshotRecord(projectId, snapshotId);
  const detail = toSnapshotDetail(snapshot);

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        name: detail.payload.project.name,
        description: detail.payload.project.description,
      },
    });

    await tx.globalConfig.upsert({
      where: { projectId },
      update: {
        latencyEnabled: detail.payload.globalConfig.latencyEnabled,
        latencyMinMs: detail.payload.globalConfig.latencyMinMs,
        latencyMaxMs: detail.payload.globalConfig.latencyMaxMs,
        latencyMode: detail.payload.globalConfig.latencyMode,
        errorSimulationEnabled: detail.payload.globalConfig.errorSimulationEnabled,
        errorSimulationRate: detail.payload.globalConfig.errorSimulationRate,
        errorSimulationCodes: detail.payload.globalConfig.errorSimulationCodes,
        rateLimitingEnabled: detail.payload.globalConfig.rateLimitingEnabled,
        rateLimitingRpm: detail.payload.globalConfig.rateLimitingRpm,
        loggingLevel: detail.payload.globalConfig.loggingLevel,
        scope: 'all',
      },
      create: {
        projectId,
        latencyEnabled: detail.payload.globalConfig.latencyEnabled,
        latencyMinMs: detail.payload.globalConfig.latencyMinMs,
        latencyMaxMs: detail.payload.globalConfig.latencyMaxMs,
        latencyMode: detail.payload.globalConfig.latencyMode,
        errorSimulationEnabled: detail.payload.globalConfig.errorSimulationEnabled,
        errorSimulationRate: detail.payload.globalConfig.errorSimulationRate,
        errorSimulationCodes: detail.payload.globalConfig.errorSimulationCodes,
        rateLimitingEnabled: detail.payload.globalConfig.rateLimitingEnabled,
        rateLimitingRpm: detail.payload.globalConfig.rateLimitingRpm,
        loggingLevel: detail.payload.globalConfig.loggingLevel,
        scope: 'all',
      },
    });

    const liveEndpoints = await tx.endpoint.findMany({
      where: { projectId },
      select: { id: true, method: true, path: true },
    });
    const plan = planSnapshotEndpointReconciliation(detail.payload.endpoints, liveEndpoints);
    const liveByKey = new Map(
      liveEndpoints.map((endpoint) => [
        buildSnapshotEndpointKey(endpoint.method, endpoint.path),
        endpoint,
      ])
    );

    for (const endpoint of detail.payload.endpoints) {
      const key = buildSnapshotEndpointKey(endpoint.method, endpoint.path);
      const existing = liveByKey.get(key);
      const restored = existing
        ? await tx.endpoint.update({
            where: { id: existing.id },
            data: {
              description: endpoint.description,
              statusCode: endpoint.statusCode,
              responseBody: toPrismaJson(endpoint.responseBody),
            },
            select: { id: true },
          })
        : await tx.endpoint.create({
            data: {
              projectId,
              method: endpoint.method,
              path: endpoint.path,
              description: endpoint.description,
              statusCode: endpoint.statusCode,
              responseBody: toPrismaJson(endpoint.responseBody),
            },
            select: { id: true },
          });

      await tx.endpointConfig.upsert({
        where: { endpointId: restored.id },
        update: {
          latencyMode: endpoint.endpointConfig.latencyMode,
          fixedDelayMs: endpoint.endpointConfig.fixedDelayMs,
          minDelayMs: endpoint.endpointConfig.minDelayMs,
          maxDelayMs: endpoint.endpointConfig.maxDelayMs,
          errorRate: endpoint.endpointConfig.errorRate,
          useScenarioWeights: endpoint.endpointConfig.useScenarioWeights,
        },
        create: {
          endpointId: restored.id,
          latencyMode: endpoint.endpointConfig.latencyMode,
          fixedDelayMs: endpoint.endpointConfig.fixedDelayMs,
          minDelayMs: endpoint.endpointConfig.minDelayMs,
          maxDelayMs: endpoint.endpointConfig.maxDelayMs,
          errorRate: endpoint.endpointConfig.errorRate,
          useScenarioWeights: endpoint.endpointConfig.useScenarioWeights,
        },
      });

      await tx.scenario.deleteMany({ where: { endpointId: restored.id } });
      if (endpoint.scenarios.length > 0) {
        await tx.scenario.createMany({
          data: endpoint.scenarios.map((scenario) => ({
            endpointId: restored.id,
            name: scenario.name,
            type: scenario.type,
            statusCode: scenario.statusCode,
            body: toPrismaJson(scenario.body),
            delayMs: scenario.delayMs,
            weight: scenario.weight,
          })),
        });
      }
    }

    if (plan.deleteIds.length > 0) {
      await tx.endpoint.deleteMany({ where: { id: { in: plan.deleteIds } } });
    }

    await writeAuditEvent(tx, {
      actor,
      workspaceId: projectAccess.workspaceId ?? '',
      projectId,
      resourceType: 'snapshot',
      resourceId: snapshot.id,
      action: 'restored',
      summary: `Restored snapshot ${snapshot.name}`,
      metadata: {
        snapshotName: snapshot.name,
        restoredEndpointCount: detail.payload.endpoints.length,
        deletedEndpointCount: plan.deleteIds.length,
      },
    });
  });

  return { restoredSnapshotId: snapshot.id };
}
