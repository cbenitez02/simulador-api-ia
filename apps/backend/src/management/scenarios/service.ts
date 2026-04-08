import { prisma } from '../../lib/prisma.js';
import { toPrismaJson } from '../../lib/prisma-json.js';
import { AppError } from '../../middleware/error-handler.js';
import type { CreateScenarioInput, UpdateScenarioInput } from './schema.js';

async function assertEndpointExists(endpointId: string): Promise<void> {
  const endpoint = await prisma.endpoint.findUnique({
    where: { id: endpointId },
    select: { id: true },
  });

  if (!endpoint) {
    throw new AppError(404, 'Endpoint not found');
  }
}

export async function listScenarios(endpointId: string) {
  await assertEndpointExists(endpointId);

  return prisma.scenario.findMany({
    where: { endpointId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createScenario(endpointId: string, input: CreateScenarioInput) {
  await assertEndpointExists(endpointId);

  return prisma.scenario.create({
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
}

export async function updateScenario(
  endpointId: string,
  scenarioId: string,
  input: UpdateScenarioInput
) {
  const scenario = await prisma.scenario.findFirst({
    where: { id: scenarioId, endpointId },
    select: { id: true },
  });

  if (!scenario) {
    throw new AppError(404, 'Scenario not found');
  }

  return prisma.scenario.update({
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
}

export async function deleteScenario(endpointId: string, scenarioId: string): Promise<void> {
  const scenario = await prisma.scenario.findFirst({
    where: { id: scenarioId, endpointId },
    select: { id: true },
  });

  if (!scenario) {
    throw new AppError(404, 'Scenario not found');
  }

  await prisma.scenario.delete({ where: { id: scenarioId } });
}
