import type { GlobalConfig } from '../models/global-config.model';
import type { GlobalConfigDto, SaveGlobalConfigDto } from '../../../shared/http/api.types';

export function mapGlobalConfigFromApi(config: GlobalConfigDto): GlobalConfig {
  return {
    latency: {
      enabled: config.latencyEnabled,
      minMs: config.latencyMinMs,
      maxMs: config.latencyMaxMs,
      mode: config.latencyMode === 'range' ? 'random' : 'fixed',
    },
    errorSimulation: {
      enabled: config.errorSimulationEnabled,
      rate: Math.round(config.errorSimulationRate * 100),
      statusCodes: config.errorSimulationCodes,
    },
    rateLimiting: {
      enabled: config.rateLimitingEnabled,
      requestsPerMinute: config.rateLimitingRpm,
    },
    logging: {
      level: config.loggingLevel === 'full' ? 'verbose' : config.loggingLevel === 'off' ? 'none' : 'basic',
    },
    scope: 'all',
  };
}

export function mapGlobalConfigToApi(config: GlobalConfig): SaveGlobalConfigDto {
  return {
    latencyEnabled: config.latency.enabled,
    latencyMinMs: config.latency.minMs,
    latencyMaxMs: config.latency.maxMs,
    latencyMode: config.latency.mode === 'random' ? 'range' : 'fixed',
    errorSimulationEnabled: config.errorSimulation.enabled,
    errorSimulationRate: config.errorSimulation.rate / 100,
    errorSimulationCodes: config.errorSimulation.statusCodes,
    rateLimitingEnabled: config.rateLimiting.enabled,
    rateLimitingRpm: config.rateLimiting.requestsPerMinute,
    loggingLevel: config.logging.level === 'verbose' ? 'full' : config.logging.level === 'none' ? 'off' : 'basic',
    scope: 'all',
  };
}
