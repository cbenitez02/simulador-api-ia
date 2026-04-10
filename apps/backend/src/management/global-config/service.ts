import { authorizeProjectAccess } from '../../auth/authorization.js';
import type { AuthenticatedActor } from '../../auth/types.js';
import { prisma } from '../../lib/prisma.js';
import type { UpsertGlobalConfigInput } from './schema.js';
export { buildDefaultGlobalConfig, DEFAULT_GLOBAL_CONFIG_VALUES } from './defaults.js';
import { buildDefaultGlobalConfig } from './defaults.js';

function canonicalizeGlobalConfig(input: UpsertGlobalConfigInput): UpsertGlobalConfigInput {
  return {
    ...input,
    scope: 'all',
  };
}

export async function getGlobalConfig(actor: AuthenticatedActor, projectId: string) {
  await authorizeProjectAccess(actor, projectId);

  const config = await prisma.globalConfig.findUnique({
    where: { projectId },
  });

  if (config) {
    return config;
  }

  return buildDefaultGlobalConfig(projectId);
}

export async function upsertGlobalConfig(
  actor: AuthenticatedActor,
  projectId: string,
  input: UpsertGlobalConfigInput
) {
  await authorizeProjectAccess(actor, projectId);

  const canonical = canonicalizeGlobalConfig(input);

  return prisma.globalConfig.upsert({
    where: { projectId },
    update: {
      latencyEnabled: canonical.latencyEnabled,
      latencyMinMs: canonical.latencyMinMs,
      latencyMaxMs: canonical.latencyMaxMs,
      latencyMode: canonical.latencyMode,
      errorSimulationEnabled: canonical.errorSimulationEnabled,
      errorSimulationRate: canonical.errorSimulationRate,
      errorSimulationCodes: canonical.errorSimulationCodes,
      rateLimitingEnabled: canonical.rateLimitingEnabled,
      rateLimitingRpm: canonical.rateLimitingRpm,
      loggingLevel: canonical.loggingLevel,
      scope: canonical.scope,
    },
    create: {
      projectId,
      latencyEnabled: canonical.latencyEnabled,
      latencyMinMs: canonical.latencyMinMs,
      latencyMaxMs: canonical.latencyMaxMs,
      latencyMode: canonical.latencyMode,
      errorSimulationEnabled: canonical.errorSimulationEnabled,
      errorSimulationRate: canonical.errorSimulationRate,
      errorSimulationCodes: canonical.errorSimulationCodes,
      rateLimitingEnabled: canonical.rateLimitingEnabled,
      rateLimitingRpm: canonical.rateLimitingRpm,
      loggingLevel: canonical.loggingLevel,
      scope: canonical.scope,
    },
  });
}
