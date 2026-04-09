import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(__dirname, '../../.env') });

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}, z.string().min(1).optional());

const defaultedNonEmptyString = (fallback: string) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    return trimmed === '' ? undefined : trimmed;
  }, z.string().min(1).default(fallback));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_MODEL: defaultedNonEmptyString('gpt-4.1-mini'),
  MOCK_BASE_URL: z.string().url().default('http://localhost:3000/mock'),
});

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  return envSchema.parse(input);
}

export const env = parseEnv(process.env);
export type Env = z.infer<typeof envSchema>;
