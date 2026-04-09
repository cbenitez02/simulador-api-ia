import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type { UpsertEndpointConfigInput } from './schema.js';

function canonicalizeEndpointConfig(input: UpsertEndpointConfigInput): UpsertEndpointConfigInput {
  return {
    ...input,
    errorRate: 0,
  };
}

async function assertEndpointExists(endpointId: string): Promise<void> {
  const endpoint = await prisma.endpoint.findUnique({
    where: { id: endpointId },
    select: { id: true },
  });

  if (!endpoint) {
    throw new AppError(404, 'Endpoint not found');
  }
}

export async function getEndpointConfig(endpointId: string) {
  await assertEndpointExists(endpointId);

  const config = await prisma.endpointConfig.findUnique({
    where: { endpointId },
  });

  if (config) {
    return config;
  }

  return {
    endpointId,
    latencyMode: 'fixed',
    fixedDelayMs: 0,
    minDelayMs: 0,
    maxDelayMs: 500,
    errorRate: 0,
    useScenarioWeights: true,
  };
}

export async function upsertEndpointConfig(endpointId: string, input: UpsertEndpointConfigInput) {
  await assertEndpointExists(endpointId);

  const canonical = canonicalizeEndpointConfig(input);

  return prisma.endpointConfig.upsert({
    where: { endpointId },
    update: {
      latencyMode: canonical.latencyMode,
      fixedDelayMs: canonical.fixedDelayMs,
      minDelayMs: canonical.minDelayMs,
      maxDelayMs: canonical.maxDelayMs,
      errorRate: canonical.errorRate,
      useScenarioWeights: canonical.useScenarioWeights,
    },
    create: {
      endpointId,
      latencyMode: canonical.latencyMode,
      fixedDelayMs: canonical.fixedDelayMs,
      minDelayMs: canonical.minDelayMs,
      maxDelayMs: canonical.maxDelayMs,
      errorRate: canonical.errorRate,
      useScenarioWeights: canonical.useScenarioWeights,
    },
  });
}
