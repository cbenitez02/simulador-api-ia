import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:54329/simulador_api?schema=public',
  NODE_ENV: 'test' as const,
};

describe('parseEnv', () => {
  it('permite boot sin credenciales de OpenAI y normaliza strings vacíos', () => {
    const parsed = parseEnv({
      ...baseEnv,
      OPENAI_API_KEY: '   ',
      OPENAI_MODEL: '   ',
    });

    expect(parsed.OPENAI_API_KEY).toBeUndefined();
    expect(parsed.OPENAI_MODEL).toBe('gpt-4.1-mini');
  });

  it('preserva configuración válida de OpenAI cuando existe', () => {
    const parsed = parseEnv({
      ...baseEnv,
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-4.1-mini',
    });

    expect(parsed.OPENAI_API_KEY).toBe('test-key');
    expect(parsed.OPENAI_MODEL).toBe('gpt-4.1-mini');
  });
});
