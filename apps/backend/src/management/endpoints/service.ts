import { authorizeProjectAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { toPrismaJson } from '../../lib/prisma-json.js';
import { AppError } from '../../middleware/error-handler.js';
import type { CreateEndpointInput, UpdateEndpointInput } from './schema.js';

export async function listEndpoints(actor: AuthenticatedActor, projectId: string) {
  await authorizeProjectAccess(actor, projectId);

  return prisma.endpoint.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { scenarios: true },
      },
    },
  });
}

export async function getEndpointById(
  actor: AuthenticatedActor,
  projectId: string,
  endpointId: string
) {
  await authorizeProjectAccess(actor, projectId);

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
  await authorizeProjectAccess(actor, projectId);

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
  await authorizeProjectAccess(actor, projectId);

  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, projectId },
    select: { id: true },
  });

  if (!endpoint) {
    throw new AppError(404, 'Endpoint not found');
  }

  return prisma.endpoint.update({
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
    },
  });
}

export async function deleteEndpoint(
  actor: AuthenticatedActor,
  projectId: string,
  endpointId: string
): Promise<void> {
  await authorizeProjectAccess(actor, projectId);

  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, projectId },
    select: { id: true },
  });

  if (!endpoint) {
    throw new AppError(404, 'Endpoint not found');
  }

  await prisma.endpoint.delete({ where: { id: endpointId } });
}
