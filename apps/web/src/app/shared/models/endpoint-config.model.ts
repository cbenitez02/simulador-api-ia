import type { MockScenarioId } from './mock-scenario.model';

/** Simulator tuning for latency, failures, and response scenarios (mock / future backend). */
export interface EndpointConfig {
  latencyMs: number;
  /** 0–100 simulated error probability for this endpoint. */
  errorRatePct: number;
  /** Which scenario variants are enabled for this mock. */
  scenarios: Record<MockScenarioId, boolean>;
}
