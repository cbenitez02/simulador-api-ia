import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type { UpsertGlobalConfigInput } from './schema.js';
export { buildDefaultGlobalConfig, DEFAULT_GLOBAL_CONFIG_VALUES } from './defaults.js';
import { buildDefaultGlobalConfig } from './defaults.js';

function canonicalizeGlobalConfig(input: UpsertGlobalConfigInput): UpsertGlobalConfigInput {
  return {
    ...input,
    scope: 'all',
  };
}

async function assertProjectExists(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }
}

export async function getGlobalConfig(projectId: string) {
  await assertProjectExists(projectId);

  const config = await prisma.globalConfig.findUnique({
    where: { projectId },
  });

  if (config) {
    return config;
  }

  return buildDefaultGlobalConfig(projectId);
}

export async function upsertGlobalConfig(projectId: string, input: UpsertGlobalConfigInput) {
  await assertProjectExists(projectId);

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
