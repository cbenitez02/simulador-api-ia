import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.js';
import {
  buildAiExecutionIdentity,
  buildAiPreviewCacheKey,
  buildProviderFingerprint,
} from './execution-identity.js';
import { activeAiPromptDescriptor } from './prompt-descriptor.js';

function buildEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://user:password@localhost:5432/simulador_api_ia_test',
    AI_PRIMARY_PROVIDER: 'openai',
    AI_FALLBACK_PROVIDER: undefined,
    AI_COMPAT_API_KEY: undefined,
    AI_COMPAT_MODEL: undefined,
    AI_COMPAT_BASE_URL: undefined,
    OPENAI_API_KEY: 'openai-key',
    OPENAI_MODEL: 'gpt-4.1-mini',
    MOCK_BASE_URL: 'http://localhost:3000/mock',
    CORS_ALLOWED_ORIGINS: undefined,
    ...overrides,
  };
}

describe('buildAiExecutionIdentity', () => {
  it('resuelve el descriptor activo con id, version y fingerprint determinístico', () => {
    const identity = buildAiExecutionIdentity(
      buildEnv({
        AI_PRIMARY_PROVIDER: 'compat',
        AI_FALLBACK_PROVIDER: 'openai',
        AI_COMPAT_API_KEY: 'compat-key',
        AI_COMPAT_MODEL: 'compat-model',
        AI_COMPAT_BASE_URL: 'https://compat.example.com/v1',
        OPENAI_MODEL: 'gpt-4.1-mini',
      }),
      'p1',
      '  Generate users  ',
      activeAiPromptDescriptor
    );

    expect(identity).toEqual({
      projectId: 'p1',
      normalizedPrompt: 'Generate users',
      prompt: {
        id: activeAiPromptDescriptor.id,
        version: activeAiPromptDescriptor.version,
      },
      providerFingerprint: [
        'compat:compat-model:https://compat.example.com/v1',
        'openai:gpt-4.1-mini',
      ],
    });
  });

  it('normaliza el prompt sólo con trim y conserva cambios internos', () => {
    const trimmedIdentity = buildAiExecutionIdentity(
      buildEnv(),
      'p1',
      '  Generate users  ',
      activeAiPromptDescriptor
    );

    const internalWhitespaceIdentity = buildAiExecutionIdentity(
      buildEnv(),
      'p1',
      'Generate   users',
      activeAiPromptDescriptor
    );

    expect(trimmedIdentity.normalizedPrompt).toBe('Generate users');
    expect(buildAiPreviewCacheKey(trimmedIdentity)).toBe(
      buildAiPreviewCacheKey(
        buildAiExecutionIdentity(buildEnv(), 'p1', 'Generate users', activeAiPromptDescriptor)
      )
    );
    expect(internalWhitespaceIdentity.normalizedPrompt).toBe('Generate   users');
    expect(buildAiPreviewCacheKey(internalWhitespaceIdentity)).not.toBe(
      buildAiPreviewCacheKey(trimmedIdentity)
    );
  });
});

describe('buildProviderFingerprint', () => {
  it('incluye provider/model/baseURL con orden estable para la cadena resuelta', () => {
    expect(
      buildProviderFingerprint(
        buildEnv({
          AI_PRIMARY_PROVIDER: 'compat',
          AI_FALLBACK_PROVIDER: 'openai',
          AI_COMPAT_API_KEY: 'compat-key',
          AI_COMPAT_MODEL: 'compat-model',
          AI_COMPAT_BASE_URL: 'https://compat.example.com/v1',
          OPENAI_MODEL: 'gpt-4.1-mini',
        })
      )
    ).toEqual(['compat:compat-model:https://compat.example.com/v1', 'openai:gpt-4.1-mini']);
  });

  it('deduplica la cadena de providers sin perder el fingerprint del modelo activo', () => {
    expect(
      buildProviderFingerprint(
        buildEnv({
          AI_PRIMARY_PROVIDER: 'openai',
          AI_FALLBACK_PROVIDER: 'openai',
          OPENAI_MODEL: 'gpt-4.1-nano',
        })
      )
    ).toEqual(['openai:gpt-4.1-nano']);
  });
});
