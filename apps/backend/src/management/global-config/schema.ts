import { z } from 'zod';

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const latencyModeSchema = z.enum(['fixed', 'range']);
export const loggingLevelSchema = z.enum(['basic', 'full', 'off']);
export const scopeSchema = z.enum(['all', 'unset']);

export const upsertGlobalConfigSchema = z
  .object({
    latencyEnabled: z.boolean().default(false),
    latencyMinMs: z.number().int().min(0).max(30000).default(0),
    latencyMaxMs: z.number().int().min(0).max(30000).default(1000),
    latencyMode: latencyModeSchema.default('fixed'),
    errorSimulationEnabled: z.boolean().default(false),
    errorSimulationRate: z.number().min(0).max(1).default(0),
    errorSimulationCodes: z.array(z.number().int().min(100).max(599)).default([500]),
    rateLimitingEnabled: z.boolean().default(false),
    rateLimitingRpm: z.number().int().min(1).default(60),
    loggingLevel: loggingLevelSchema.default('basic'),
    scope: scopeSchema.default('all'),
  })
  .refine((input) => input.latencyMinMs <= input.latencyMaxMs, {
    message: 'latencyMinMs must be less than or equal to latencyMaxMs',
  })
  .refine((input) => !input.errorSimulationEnabled || input.errorSimulationCodes.length > 0, {
    message: 'errorSimulationCodes must include at least one status code',
  });

export type UpsertGlobalConfigInput = z.infer<typeof upsertGlobalConfigSchema>;
