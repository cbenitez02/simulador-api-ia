import { describe, expect, it } from 'vitest';
import { resolveAiProviderChain } from './provider.js';
import { createCompatAiProvider } from './providers/compat.js';
import { createOpenAiProvider } from './providers/openai.js';

describe('resolveAiProviderChain', () => {
  it('devuelve la cadena primaria y fallback en orden', () => {
    const chain = resolveAiProviderChain({
      AI_PRIMARY_PROVIDER: 'openai',
      AI_FALLBACK_PROVIDER: 'compat',
    });

    expect(chain).toEqual(['openai', 'compat']);
  });

  it('deduplica fallback repetido para no ejecutar dos veces el mismo provider', () => {
    const chain = resolveAiProviderChain({
      AI_PRIMARY_PROVIDER: 'openai',
      AI_FALLBACK_PROVIDER: 'openai',
    });

    expect(chain).toEqual(['openai']);
  });
});

describe('provider adapters', () => {
  it('reporta missing-config para OpenAI cuando falta la API key', async () => {
    const provider = createOpenAiProvider(
      {
        OPENAI_API_KEY: undefined,
        OPENAI_MODEL: 'gpt-4.1-mini',
      },
      { systemPrompt: 'system' }
    );

    await expect(provider.generateJson('prompt')).rejects.toMatchObject({
      kind: 'missing-config',
      details: 'OPENAI_API_KEY is not configured',
      provider: 'openai',
    });
  });

  it('reporta missing-config para compat cuando faltan credenciales requeridas', async () => {
    const provider = createCompatAiProvider(
      {
        AI_COMPAT_API_KEY: 'compat-key',
        AI_COMPAT_MODEL: undefined,
        AI_COMPAT_BASE_URL: undefined,
      },
      { systemPrompt: 'system' }
    );

    await expect(provider.generateJson('prompt')).rejects.toMatchObject({
      kind: 'missing-config',
      provider: 'compat',
    });
  });
});
