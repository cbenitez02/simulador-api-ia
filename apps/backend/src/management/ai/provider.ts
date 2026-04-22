import type { Env } from '../../config/env.js';

export type AiProviderName = 'openai' | 'compat';

export interface AiProvider {
  name: AiProviderName;
  generateJson(prompt: string): Promise<string>;
}

export class AiProviderExecutionError extends Error {
  constructor(
    public readonly provider: AiProviderName,
    public readonly kind: 'missing-config' | 'timeout' | 'unavailable',
    public readonly details?: string
  ) {
    super(kind);
    this.name = 'AiProviderExecutionError';
  }
}

type AiProviderChainConfig = Pick<Env, 'AI_PRIMARY_PROVIDER' | 'AI_FALLBACK_PROVIDER'>;

export function resolveAiProviderChain(config: AiProviderChainConfig): AiProviderName[] {
  const orderedProviders = [config.AI_PRIMARY_PROVIDER, config.AI_FALLBACK_PROVIDER].filter(
    (provider): provider is AiProviderName => provider !== undefined
  );

  return orderedProviders.filter((provider, index) => orderedProviders.indexOf(provider) === index);
}
