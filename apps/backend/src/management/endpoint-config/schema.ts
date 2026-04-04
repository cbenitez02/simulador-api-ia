import { z } from 'zod';

export const endpointParamsSchema = z.object({
  endpointId: z.string().min(1),
});

export const latencyModeSchema = z.enum(['fixed', 'range']);

export const upsertEndpointConfigSchema = z
  .object({
    latencyMode: latencyModeSchema.default('fixed'),
    fixedDelayMs: z.number().int().min(0).max(30000).default(0),
    minDelayMs: z.number().int().min(0).max(30000).default(0),
    maxDelayMs: z.number().int().min(0).max(30000).default(500),
    errorRate: z.number().min(0).max(1).default(0),
    useScenarioWeights: z.boolean().default(true),
  })
  .refine((input) => input.minDelayMs <= input.maxDelayMs, {
    message: 'minDelayMs must be less than or equal to maxDelayMs',
  });

export type UpsertEndpointConfigInput = z.infer<typeof upsertEndpointConfigSchema>;
