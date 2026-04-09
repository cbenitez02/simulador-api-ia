interface EndpointLatencyConfig {
  latencyMode: string;
  fixedDelayMs: number;
  minDelayMs: number;
  maxDelayMs: number;
}

interface GlobalLatencyConfig {
  latencyEnabled: boolean;
  latencyMode: string;
  latencyMinMs: number;
  latencyMaxMs: number;
}

function randomInt(min: number, max: number): number {
  const normalizedMin = Math.ceil(min);
  const normalizedMax = Math.floor(max);

  if (normalizedMax <= normalizedMin) {
    return normalizedMin;
  }

  return Math.floor(Math.random() * (normalizedMax - normalizedMin + 1)) + normalizedMin;
}

export function calculateLatency(
  scenarioDelayMs: number,
  endpointConfig: EndpointLatencyConfig | null,
  globalConfig: GlobalLatencyConfig | null
): number {
  if (globalConfig?.latencyEnabled) {
    if (globalConfig.latencyMode === 'range') {
      return Math.min(randomInt(globalConfig.latencyMinMs, globalConfig.latencyMaxMs), 30_000);
    }

    return Math.min(globalConfig.latencyMinMs, 30_000);
  }

  if (scenarioDelayMs > 0) {
    return Math.min(scenarioDelayMs, 30_000);
  }

  if (!endpointConfig) {
    return 0;
  }

  if (endpointConfig.latencyMode === 'range') {
    return Math.min(randomInt(endpointConfig.minDelayMs, endpointConfig.maxDelayMs), 30_000);
  }

  return Math.min(endpointConfig.fixedDelayMs, 30_000);
}

export async function applyLatency(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
