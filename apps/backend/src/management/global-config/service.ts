import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import type { UpsertGlobalConfigInput } from './schema.js';

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

  return {
    projectId,
    latencyEnabled: false,
    latencyMinMs: 0,
    latencyMaxMs: 1000,
    latencyMode: 'fixed',
    errorSimulationEnabled: false,
    errorSimulationRate: 0,
    errorSimulationCodes: [500],
    rateLimitingEnabled: false,
    rateLimitingRpm: 60,
    loggingLevel: 'basic',
    scope: 'all',
  };
}

export async function upsertGlobalConfig(projectId: string, input: UpsertGlobalConfigInput) {
  await assertProjectExists(projectId);

  return prisma.globalConfig.upsert({
    where: { projectId },
    update: {
      latencyEnabled: input.latencyEnabled,
      latencyMinMs: input.latencyMinMs,
      latencyMaxMs: input.latencyMaxMs,
      latencyMode: input.latencyMode,
      errorSimulationEnabled: input.errorSimulationEnabled,
      errorSimulationRate: input.errorSimulationRate,
      errorSimulationCodes: input.errorSimulationCodes,
      rateLimitingEnabled: input.rateLimitingEnabled,
      rateLimitingRpm: input.rateLimitingRpm,
      loggingLevel: input.loggingLevel,
      scope: input.scope,
    },
    create: {
      projectId,
      latencyEnabled: input.latencyEnabled,
      latencyMinMs: input.latencyMinMs,
      latencyMaxMs: input.latencyMaxMs,
      latencyMode: input.latencyMode,
      errorSimulationEnabled: input.errorSimulationEnabled,
      errorSimulationRate: input.errorSimulationRate,
      errorSimulationCodes: input.errorSimulationCodes,
      rateLimitingEnabled: input.rateLimitingEnabled,
      rateLimitingRpm: input.rateLimitingRpm,
      loggingLevel: input.loggingLevel,
      scope: input.scope,
    },
  });
}
