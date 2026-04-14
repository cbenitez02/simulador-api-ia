import { authorizeEndpointAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import type { UpsertEndpointConfigInput } from './schema.js';

function canonicalizeEndpointConfig(input: UpsertEndpointConfigInput): UpsertEndpointConfigInput {
  return {
    ...input,
    errorRate: 0,
  };
}

export async function getEndpointConfig(actor: AuthenticatedActor, endpointId: string) {
  await authorizeEndpointAccess(actor, endpointId);

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

export async function upsertEndpointConfig(
  actor: AuthenticatedActor,
  endpointId: string,
  input: UpsertEndpointConfigInput
) {
  await authorizeEndpointAccess(actor, endpointId, 'mutate');

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
