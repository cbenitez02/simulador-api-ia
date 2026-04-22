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

const optionalProviderName = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim().toLowerCase();

    return trimmed === '' ? undefined : trimmed;
  },
  z.enum(['openai', 'compat']).optional()
);

const optionalStringArray = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    return items.length > 0 ? items : undefined;
  },
  z.array(z.string().min(1)).optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  AI_PRIMARY_PROVIDER: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim().toLowerCase();

      return trimmed === '' ? undefined : trimmed;
    },
    z.enum(['openai', 'compat']).default('openai')
  ),
  AI_FALLBACK_PROVIDER: optionalProviderName,
  AI_COMPAT_API_KEY: optionalNonEmptyString,
  AI_COMPAT_MODEL: optionalNonEmptyString,
  AI_COMPAT_BASE_URL: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    return trimmed === '' ? undefined : trimmed;
  }, z.string().url().optional()),
  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_MODEL: defaultedNonEmptyString('gpt-4.1-mini'),
  MOCK_BASE_URL: z.string().url().default('http://localhost:3000/mock'),
  CORS_ALLOWED_ORIGINS: optionalStringArray,
});

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  return envSchema.parse(input);
}

export const env = parseEnv(process.env);
export type Env = z.infer<typeof envSchema>;
