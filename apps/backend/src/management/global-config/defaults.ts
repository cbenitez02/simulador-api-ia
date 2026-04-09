export const DEFAULT_GLOBAL_CONFIG_VALUES = {
  latencyEnabled: false,
  latencyMinMs: 0,
  latencyMaxMs: 1000,
  latencyMode: 'fixed' as const,
  errorSimulationEnabled: false,
  errorSimulationRate: 0,
  errorSimulationCodes: [500],
  rateLimitingEnabled: false,
  rateLimitingRpm: 60,
  loggingLevel: 'basic' as const,
  scope: 'all' as const,
};

export function buildDefaultGlobalConfig(projectId: string) {
  return {
    projectId,
    ...DEFAULT_GLOBAL_CONFIG_VALUES,
    errorSimulationCodes: [...DEFAULT_GLOBAL_CONFIG_VALUES.errorSimulationCodes],
  };
}
