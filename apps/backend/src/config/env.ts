import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default('gpt-4.1-mini'),
  MOCK_BASE_URL: z.string().url().default('http://localhost:3000/mock'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
