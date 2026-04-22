import OpenAI from 'openai';
import type { Env } from '../../../config/env.js';
import { AiProviderExecutionError, type AiProvider } from '../provider.js';

type OpenAiConfig = Pick<Env, 'OPENAI_API_KEY' | 'OPENAI_MODEL'>;

async function requestJsonCompletion(
  provider: AiProvider['name'],
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
      reject(new AiProviderExecutionError(provider, 'timeout'));
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
      throw new AiProviderExecutionError(provider, 'timeout');
    }

    throw new AiProviderExecutionError(provider, 'unavailable');
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function createOpenAiProvider(
  config: OpenAiConfig,
  options: { systemPrompt: string; timeoutMs?: number }
): AiProvider {
  return {
    name: 'openai',
    async generateJson(prompt: string) {
      if (!config.OPENAI_API_KEY) {
        throw new AiProviderExecutionError(
          'openai',
          'missing-config',
          'OPENAI_API_KEY is not configured'
        );
      }

      const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });

      return requestJsonCompletion(
        'openai',
        client,
        config.OPENAI_MODEL,
        options.systemPrompt,
        prompt,
        options.timeoutMs
      );
    },
  };
}
