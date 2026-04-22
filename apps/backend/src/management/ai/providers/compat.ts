import OpenAI from 'openai';
import type { Env } from '../../../config/env.js';
import { AiProviderExecutionError, type AiProvider } from '../provider.js';

type CompatConfig = Pick<Env, 'AI_COMPAT_API_KEY' | 'AI_COMPAT_MODEL' | 'AI_COMPAT_BASE_URL'>;

async function requestJsonCompletion(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  prompt: string,
  timeoutMs = 30_000
): Promise<string> {
  const completionPromise = client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  });

  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new AiProviderExecutionError('compat', 'timeout'));
    }, timeoutMs);
  });

  try {
    const completion = await Promise.race([completionPromise, timeoutPromise]);

    return completion.choices[0]?.message?.content?.trim() ?? '';
  } catch (error) {
    if (error instanceof AiProviderExecutionError) {
      throw error;
    }

    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;

    if (errorCode === 'ETIMEDOUT') {
      throw new AiProviderExecutionError('compat', 'timeout');
    }

    throw new AiProviderExecutionError('compat', 'unavailable');
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function createCompatAiProvider(
  config: CompatConfig,
  options: { systemPrompt: string; timeoutMs?: number }
): AiProvider {
  return {
    name: 'compat',
    async generateJson(prompt: string) {
      const missing: string[] = [];
      const apiKey = config.AI_COMPAT_API_KEY;
      const model = config.AI_COMPAT_MODEL;
      const baseURL = config.AI_COMPAT_BASE_URL;

      if (!apiKey) {
        missing.push('AI_COMPAT_API_KEY');
      }

      if (!model) {
        missing.push('AI_COMPAT_MODEL');
      }

      if (!baseURL) {
        missing.push('AI_COMPAT_BASE_URL');
      }

      if (missing.length > 0) {
        throw new AiProviderExecutionError(
          'compat',
          'missing-config',
          `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not configured`
        );
      }

      if (!apiKey || !model || !baseURL) {
        throw new AiProviderExecutionError('compat', 'missing-config');
      }

      const client = new OpenAI({
        apiKey,
        baseURL,
      });

      return requestJsonCompletion(client, model, options.systemPrompt, prompt, options.timeoutMs);
    },
  };
}
