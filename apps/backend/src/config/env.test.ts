import { beforeAll, describe, expect, it } from 'vitest';
import type { parseEnv as parseEnvFn } from './env.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:54329/simulador_api?schema=public',
  NODE_ENV: 'test' as const,
};

let parseEnv: typeof parseEnvFn;

beforeAll(async () => {
  process.env.DATABASE_URL ??= baseEnv.DATABASE_URL;
  ({ parseEnv } = await import('./env.js'));
});

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

  it('normaliza CORS_ALLOWED_ORIGINS como lista separada por comas', () => {
    const parsed = parseEnv({
      ...baseEnv,
      CORS_ALLOWED_ORIGINS:
        'https://app.example.com, https://admin.example.com , http://localhost:4200',
    });

    expect(parsed.CORS_ALLOWED_ORIGINS).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
      'http://localhost:4200',
    ]);
  });
});
