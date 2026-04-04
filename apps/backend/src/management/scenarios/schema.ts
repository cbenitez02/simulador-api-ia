import { z } from 'zod';

export const scenarioTypeSchema = z.enum(['success', 'error', 'timeout', 'empty']);

export const endpointParamsSchema = z.object({
  endpointId: z.string().min(1),
});

export const scenarioParamsSchema = z.object({
  endpointId: z.string().min(1),
  scenarioId: z.string().min(1),
});

export const createScenarioSchema = z.object({
  name: z.string().min(1).max(100),
  type: scenarioTypeSchema,
  statusCode: z.number().int().min(100).max(599),
  body: z.unknown(),
  delayMs: z.number().int().min(0).max(30000).default(0),
  weight: z.number().int().min(1).default(1),
});

export const updateScenarioSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    type: scenarioTypeSchema.optional(),
    statusCode: z.number().int().min(100).max(599).optional(),
    body: z.unknown().optional(),
    delayMs: z.number().int().min(0).max(30000).optional(),
    weight: z.number().int().min(1).optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.type !== undefined ||
      input.statusCode !== undefined ||
      input.body !== undefined ||
      input.delayMs !== undefined ||
      input.weight !== undefined,
    {
      message: 'At least one scenario field is required',
    }
  );

export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;
