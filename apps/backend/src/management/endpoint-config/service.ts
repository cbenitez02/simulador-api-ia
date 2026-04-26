import { authorizeEndpointAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import { areJsonValuesEqual } from '../../lib/stable-json.js';
import { writeAuditEvent } from '../audit-events/service.js';
import type { UpsertEndpointConfigInput } from './schema.js';

function canonicalizeEndpointConfig(input: UpsertEndpointConfigInput): UpsertEndpointConfigInput {
  return {
    latencyMode: input.latencyMode,
    fixedDelayMs: input.fixedDelayMs,
    minDelayMs: input.minDelayMs,
    maxDelayMs: input.maxDelayMs,
    errorRate: 0,
    useScenarioWeights: input.useScenarioWeights,
  };
}

function hasEndpointConfigChanges(
  current: UpsertEndpointConfigInput,
  next: UpsertEndpointConfigInput
) {
  return !areJsonValuesEqual(current, next);
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
  const current = canonicalizeEndpointConfig(await getEndpointConfig(actor, endpointId));

  return prisma.$transaction(async (tx) => {
    const config = await tx.endpointConfig.upsert({
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

    if (!hasEndpointConfigChanges(current, canonical)) {
      return config;
    }

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
      resourceType: 'endpoint-config',
      resourceId: config.id,
      action: 'updated',
      summary: `Updated endpoint config for ${endpoint.method} ${endpoint.path}`,
      metadata: {
        method: endpoint.method,
        endpointPath: endpoint.path,
        latencyMode: canonical.latencyMode,
      },
    });

    return config;
  });
}
