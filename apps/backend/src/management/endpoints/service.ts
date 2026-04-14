import { authorizeProjectAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { toPrismaJson } from '../../lib/prisma-json.js';
import { AppError } from '../../middleware/error-handler.js';
import { writeAuditEvent } from '../audit-events/service.js';
import type {
  CreateEndpointInput,
  ListEndpointsQueryInput,
  UpdateEndpointInput,
} from './schema.js';

type PagedResult<T> = {
  items: T[];
  page: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

type EndpointListItem = {
  id: string;
  projectId: string;
  method: string;
  path: string;
  description: string;
  statusCode: number;
  updatedAt: Date;
  scenarioCount: number;
  latencyMs: number;
};

function resolveLatencyMs(
  endpointConfig: {
    latencyMode: string;
    fixedDelayMs: number;
    minDelayMs: number;
    maxDelayMs: number;
  } | null
) {
  if (!endpointConfig) return 0;
  return endpointConfig.latencyMode === 'range'
    ? Math.round((endpointConfig.minDelayMs + endpointConfig.maxDelayMs) / 2)
    : endpointConfig.fixedDelayMs;
}

function resolveEndpointOrderBy(query: ListEndpointsQueryInput) {
  switch (query.sort) {
    case 'path-desc':
      return [{ path: 'desc' as const }, { id: 'desc' as const }];
    case 'method':
      return [{ method: 'asc' as const }, { path: 'asc' as const }, { id: 'asc' as const }];
    case 'path-asc':
    default:
      return [{ path: 'asc' as const }, { id: 'asc' as const }];
  }
}

export async function listEndpoints(
  actor: AuthenticatedActor,
  projectId: string,
  query: ListEndpointsQueryInput
): Promise<PagedResult<EndpointListItem>> {
  await authorizeProjectAccess(actor, projectId);

  const where = {
    projectId,
    ...(query.q
      ? {
          OR: [
            { path: { contains: query.q, mode: 'insensitive' as const } },
            { description: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(query.method ? { method: query.method } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.endpoint.findMany({
      where,
      orderBy: resolveEndpointOrderBy(query),
      skip: query.offset,
      take: query.limit,
      select: {
        id: true,
        projectId: true,
        method: true,
        path: true,
        description: true,
        statusCode: true,
        updatedAt: true,
        endpointConfig: {
          select: {
            latencyMode: true,
            fixedDelayMs: true,
            minDelayMs: true,
            maxDelayMs: true,
          },
        },
        _count: {
          select: { scenarios: true },
        },
      },
    }),
    prisma.endpoint.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      projectId: item.projectId,
      method: item.method,
      path: item.path,
      description: item.description,
      statusCode: item.statusCode,
      updatedAt: item.updatedAt,
      scenarioCount: item._count.scenarios,
      latencyMs: resolveLatencyMs(item.endpointConfig),
    })),
    page: {
      limit: query.limit,
      offset: query.offset,
      total,
      hasMore: query.offset + items.length < total,
    },
  };
}

export async function getEndpointById(
  actor: AuthenticatedActor,
  projectId: string,
  endpointId: string
) {
  await authorizeProjectAccess(actor, projectId, 'read');

  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, projectId },
    include: {
      endpointConfig: true,
      scenarios: true,
    },
  });

  if (!endpoint) {
    throw new AppError(404, 'Endpoint not found');
  }

  return endpoint;
}

export async function createEndpoint(
  actor: AuthenticatedActor,
  projectId: string,
  input: CreateEndpointInput
) {
  await authorizeProjectAccess(actor, projectId, 'mutate');

  const duplicatedEndpoint = await prisma.endpoint.findFirst({
    where: {
      projectId,
      method: input.method,
      path: input.path,
    },
    select: { id: true },
  });

  if (duplicatedEndpoint) {
    throw new AppError(409, 'Endpoint already exists for this method and path');
  }

  return prisma.$transaction(async (tx) => {
    const endpoint = await tx.endpoint.create({
      data: {
        projectId,
        method: input.method,
        path: input.path,
        description: input.description ?? '',
        statusCode: input.statusCode,
        responseBody: toPrismaJson(input.responseBody),
      },
    });

    await tx.endpointConfig.create({
      data: {
        endpointId: endpoint.id,
      },
    });

    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { workspaceId: true },
    });

    await writeAuditEvent(tx, {
      actor,
      workspaceId: project.workspaceId ?? '',
      projectId,
      resourceType: 'endpoint',
      resourceId: endpoint.id,
      action: 'created',
      summary: `Created endpoint ${endpoint.method} ${endpoint.path}`,
      metadata: {
        method: endpoint.method,
        endpointPath: endpoint.path,
      },
    });

    return tx.endpoint.findUniqueOrThrow({
      where: { id: endpoint.id },
      include: {
        endpointConfig: true,
        scenarios: true,
      },
    });
  });
}

export async function updateEndpoint(
  actor: AuthenticatedActor,
  projectId: string,
  endpointId: string,
  input: UpdateEndpointInput
) {
  await authorizeProjectAccess(actor, projectId, 'mutate');

  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, projectId },
    select: { id: true },
  });

  if (!endpoint) {
    throw new AppError(404, 'Endpoint not found');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.endpoint.update({
      where: { id: endpointId },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.statusCode !== undefined ? { statusCode: input.statusCode } : {}),
        ...(input.responseBody !== undefined
          ? { responseBody: toPrismaJson(input.responseBody) }
          : {}),
      },
      include: {
        endpointConfig: true,
        scenarios: true,
        project: {
          select: { workspaceId: true },
        },
      },
    });

    await writeAuditEvent(tx, {
      actor,
      workspaceId: updated.project.workspaceId ?? '',
      projectId,
      resourceType: 'endpoint',
      resourceId: updated.id,
      action: 'updated',
      summary: `Updated endpoint ${updated.method} ${updated.path}`,
      metadata: {
        method: updated.method,
        endpointPath: updated.path,
      },
    });

    return updated;
  });
}

export async function deleteEndpoint(
  actor: AuthenticatedActor,
  projectId: string,
  endpointId: string
): Promise<void> {
  await authorizeProjectAccess(actor, projectId, 'mutate');

  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, projectId },
    select: { id: true },
  });

  if (!endpoint) {
    throw new AppError(404, 'Endpoint not found');
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.endpoint.findUniqueOrThrow({
      where: { id: endpointId },
      select: {
        id: true,
        method: true,
        path: true,
        project: {
          select: { workspaceId: true },
        },
      },
    });

    await writeAuditEvent(tx, {
      actor,
      workspaceId: existing.project.workspaceId ?? '',
      projectId,
      resourceType: 'endpoint',
      resourceId: existing.id,
      action: 'deleted',
      summary: `Deleted endpoint ${existing.method} ${existing.path}`,
      metadata: {
        method: existing.method,
        endpointPath: existing.path,
      },
    });

    await tx.endpoint.delete({ where: { id: endpointId } });
  });
}
