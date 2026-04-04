export interface ScenarioCandidate {
  name: string;
  type: string;
  statusCode: number;
  body: unknown;
  delayMs: number;
  weight: number;
}

export function selectScenario(
  scenarios: ScenarioCandidate[],
  useScenarioWeights: boolean
): ScenarioCandidate | null {
  if (scenarios.length === 0) {
    return null;
  }

  if (!useScenarioWeights) {
    const randomIndex = Math.floor(Math.random() * scenarios.length);
    return scenarios[randomIndex] ?? scenarios[0] ?? null;
  }

  const totalWeight = scenarios.reduce((total, scenario) => total + scenario.weight, 0);

  if (totalWeight <= 0) {
    const randomIndex = Math.floor(Math.random() * scenarios.length);
    return scenarios[randomIndex] ?? scenarios[0] ?? null;
  }

  const randomRoll = Math.random() * totalWeight;
  let accumulated = 0;

  for (const scenario of scenarios) {
    accumulated += scenario.weight;
    if (randomRoll < accumulated) {
      return scenario;
    }
  }

  return scenarios[scenarios.length - 1] ?? null;
}
