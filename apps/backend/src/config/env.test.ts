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

  it('resuelve OpenAI como provider principal por default para mantener compatibilidad', () => {
    const parsed = parseEnv({
      ...baseEnv,
      OPENAI_API_KEY: 'test-key',
    });

    expect(parsed.AI_PRIMARY_PROVIDER).toBe('openai');
    expect(parsed.AI_FALLBACK_PROVIDER).toBeUndefined();
  });

  it('acepta provider principal y fallback explícitos junto con credenciales compat', () => {
    const parsed = parseEnv({
      ...baseEnv,
      AI_PRIMARY_PROVIDER: 'compat',
      AI_FALLBACK_PROVIDER: 'openai',
      AI_COMPAT_API_KEY: 'compat-key',
      AI_COMPAT_MODEL: 'llama-3.1-70b',
      AI_COMPAT_BASE_URL: 'https://compat.example.com/v1',
    });

    expect(parsed.AI_PRIMARY_PROVIDER).toBe('compat');
    expect(parsed.AI_FALLBACK_PROVIDER).toBe('openai');
    expect(parsed.AI_COMPAT_API_KEY).toBe('compat-key');
    expect(parsed.AI_COMPAT_MODEL).toBe('llama-3.1-70b');
    expect(parsed.AI_COMPAT_BASE_URL).toBe('https://compat.example.com/v1');
  });

  it('rechaza nombres de provider inválidos', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        AI_PRIMARY_PROVIDER: 'anthropic',
      })
    ).toThrowError();
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

  it('normaliza strings vacíos para fallback y modelo compat', () => {
    const parsed = parseEnv({
      ...baseEnv,
      AI_PRIMARY_PROVIDER: 'openai',
      AI_FALLBACK_PROVIDER: '   ',
      AI_COMPAT_MODEL: '   ',
    });

    expect(parsed.AI_FALLBACK_PROVIDER).toBeUndefined();
    expect(parsed.AI_COMPAT_MODEL).toBeUndefined();
  });
});
