import type { Env } from '../../config/env.js';
import { resolveAiProviderChain } from './provider.js';
import type { AiPromptDescriptor } from './prompt-descriptor.js';

export interface AiExecutionIdentity {
  projectId: string;
  normalizedPrompt: string;
  prompt: Pick<AiPromptDescriptor, 'id' | 'version'>;
  providerFingerprint: string[];
}

export function normalizeAiPromptInput(prompt: string): string {
  return prompt.trim();
}

export function buildProviderFingerprint(env: Env): string[] {
  return resolveAiProviderChain(env).map((provider) => {
    if (provider === 'compat') {
      return `compat:${env.AI_COMPAT_MODEL ?? 'missing-model'}:${env.AI_COMPAT_BASE_URL ?? 'missing-base-url'}`;
    }

    return `openai:${env.OPENAI_MODEL}`;
  });
}

export function buildAiExecutionIdentity(
  env: Env,
  projectId: string,
  prompt: string,
  descriptor: AiPromptDescriptor
): AiExecutionIdentity {
  return {
    projectId,
    normalizedPrompt: normalizeAiPromptInput(prompt),
    prompt: {
      id: descriptor.id,
      version: descriptor.version,
    },
    providerFingerprint: buildProviderFingerprint(env),
  };
}

export function buildAiPreviewCacheKey(identity: AiExecutionIdentity): string {
  return JSON.stringify([
    identity.projectId,
    identity.normalizedPrompt,
    identity.prompt.id,
    identity.prompt.version,
    identity.providerFingerprint,
  ]);
}
