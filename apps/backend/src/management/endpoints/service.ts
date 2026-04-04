import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type { CreateEndpointInput, UpdateEndpointInput } from './schema.js';

async function assertProjectExists(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }
}

export async function listEndpoints(projectId: string) {
  await assertProjectExists(projectId);

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

export async function getEndpointById(projectId: string, endpointId: string) {
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

export async function createEndpoint(projectId: string, input: CreateEndpointInput) {
  await assertProjectExists(projectId);

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
        responseBody: input.responseBody,
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
  projectId: string,
  endpointId: string,
  input: UpdateEndpointInput
) {
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
      description: input.description,
      statusCode: input.statusCode,
      responseBody: input.responseBody,
    },
    include: {
      endpointConfig: true,
      scenarios: true,
    },
  });
}

export async function deleteEndpoint(projectId: string, endpointId: string): Promise<void> {
  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, projectId },
    select: { id: true },
  });

  if (!endpoint) {
    throw new AppError(404, 'Endpoint not found');
  }

  await prisma.endpoint.delete({ where: { id: endpointId } });
}
