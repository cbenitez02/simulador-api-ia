import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectScenario } from '../scenario-selector.js';

describe('mock-server/scenario-selector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna null si no hay escenarios', () => {
    expect(selectScenario([], true)).toBeNull();
  });

  it('selecciona por peso cuando useScenarioWeights=true', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.95);

    const picked = selectScenario(
      [
        { name: 'success', type: 'success', statusCode: 200, body: {}, delayMs: 0, weight: 9 },
        { name: 'error', type: 'error', statusCode: 500, body: {}, delayMs: 0, weight: 1 },
      ],
      true
    );

    expect(picked?.name).toBe('error');
  });

  it('selecciona uniforme cuando useScenarioWeights=false', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6);

    const picked = selectScenario(
      [
        { name: 'a', type: 'success', statusCode: 200, body: {}, delayMs: 0, weight: 100 },
        { name: 'b', type: 'error', statusCode: 500, body: {}, delayMs: 0, weight: 1 },
      ],
      false
    );

    expect(picked?.name).toBe('b');
  });
});
