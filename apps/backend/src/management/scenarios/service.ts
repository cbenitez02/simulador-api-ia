import { authorizeEndpointAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { toPrismaJson } from '../../lib/prisma-json.js';
import { AppError } from '../../middleware/error-handler.js';
import { writeAuditEvent } from '../audit-events/service.js';
import type { CreateScenarioInput, UpdateScenarioInput } from './schema.js';

export async function listScenarios(actor: AuthenticatedActor, endpointId: string) {
  await authorizeEndpointAccess(actor, endpointId);

  return prisma.scenario.findMany({
    where: { endpointId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createScenario(
  actor: AuthenticatedActor,
  endpointId: string,
  input: CreateScenarioInput
) {
  await authorizeEndpointAccess(actor, endpointId, 'mutate');

  return prisma.$transaction(async (tx) => {
    const endpoint = await tx.endpoint.findUniqueOrThrow({
      where: { id: endpointId },
      select: {
        method: true,
        path: true,
        projectId: true,
        project: {
          select: { workspaceId: true },
        },
      },
    });

    const scenario = await tx.scenario.create({
      data: {
        endpointId,
        name: input.name,
        type: input.type,
        statusCode: input.statusCode,
        body: toPrismaJson(input.body),
        delayMs: input.delayMs,
        weight: input.weight,
      },
    });

    await writeAuditEvent(tx, {
      actor,
      workspaceId: endpoint.project.workspaceId ?? '',
      projectId: endpoint.projectId,
      resourceType: 'scenario',
      resourceId: scenario.id,
      action: 'created',
      summary: `Created scenario ${scenario.name}`,
      metadata: {
        scenarioName: scenario.name,
        endpointPath: endpoint.path,
        method: endpoint.method,
      },
    });

    return scenario;
  });
}

export async function updateScenario(
  actor: AuthenticatedActor,
  endpointId: string,
  scenarioId: string,
  input: UpdateScenarioInput
) {
  await authorizeEndpointAccess(actor, endpointId, 'mutate');

  const scenario = await prisma.scenario.findFirst({
    where: { id: scenarioId, endpointId },
    select: { id: true },
  });

  if (!scenario) {
    throw new AppError(404, 'Scenario not found');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.scenario.update({
      where: { id: scenarioId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.statusCode !== undefined ? { statusCode: input.statusCode } : {}),
        ...(input.body !== undefined ? { body: toPrismaJson(input.body) } : {}),
        ...(input.delayMs !== undefined ? { delayMs: input.delayMs } : {}),
        ...(input.weight !== undefined ? { weight: input.weight } : {}),
      },
    });

    const endpoint = await tx.endpoint.findUniqueOrThrow({
      where: { id: endpointId },
      select: {
        method: true,
        path: true,
        projectId: true,
        project: {
          select: { workspaceId: true },
        },
      },
    });

    await writeAuditEvent(tx, {
      actor,
      workspaceId: endpoint.project.workspaceId ?? '',
      projectId: endpoint.projectId,
      resourceType: 'scenario',
      resourceId: updated.id,
      action: 'updated',
      summary: `Updated scenario ${updated.name}`,
      metadata: {
        scenarioName: updated.name,
        endpointPath: endpoint.path,
        method: endpoint.method,
      },
    });

    return updated;
  });
}

export async function deleteScenario(
  actor: AuthenticatedActor,
  endpointId: string,
  scenarioId: string
): Promise<void> {
  await authorizeEndpointAccess(actor, endpointId, 'mutate');

  const scenario = await prisma.scenario.findFirst({
    where: { id: scenarioId, endpointId },
    select: { id: true },
  });

  if (!scenario) {
    throw new AppError(404, 'Scenario not found');
  }

  await prisma.$transaction(async (tx) => {
    const scenario = await tx.scenario.findUniqueOrThrow({
      where: { id: scenarioId },
      select: { id: true, name: true },
    });
    const endpoint = await tx.endpoint.findUniqueOrThrow({
      where: { id: endpointId },
      select: {
        method: true,
        path: true,
        projectId: true,
        project: {
          select: { workspaceId: true },
        },
      },
    });

    await writeAuditEvent(tx, {
      actor,
      workspaceId: endpoint.project.workspaceId ?? '',
      projectId: endpoint.projectId,
      resourceType: 'scenario',
      resourceId: scenario.id,
      action: 'deleted',
      summary: `Deleted scenario ${scenario.name}`,
      metadata: {
        scenarioName: scenario.name,
        endpointPath: endpoint.path,
        method: endpoint.method,
      },
    });

    await tx.scenario.delete({ where: { id: scenarioId } });
  });
}
