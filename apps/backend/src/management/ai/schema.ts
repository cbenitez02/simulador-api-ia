import { z } from 'zod';
import { endpointMethodSchema } from '../endpoints/schema.js';
import { scenarioTypeSchema } from '../scenarios/schema.js';

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const generateEndpointRequestSchema = z.object({
  prompt: z.string().min(10).max(500),
});

export const aiPromptRequestSchema = generateEndpointRequestSchema;

export const aiRawGeneratedScenarioSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  statusCode: z.number().int().min(100).max(599),
  body: z.unknown(),
  delayMs: z.number().int().min(0).max(30000).default(0),
  weight: z.number().int().min(1).default(1),
});

export const aiRawGeneratedEndpointSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  description: z.string(),
  statusCode: z.number().int().min(100).max(599),
  responseBody: z.unknown(),
  scenarios: z.array(aiRawGeneratedScenarioSchema).min(1),
});

export const aiNormalizedScenarioSchema = z.object({
  name: z.string().min(1),
  type: scenarioTypeSchema,
  statusCode: z.number().int().min(100).max(599),
  body: z.unknown(),
  delayMs: z.number().int().min(0).max(30000),
  weight: z.number().int().min(1),
});

export const aiDraftLocksSchema = z.object({
  method: z.literal(true),
  path: z.literal(true),
  scenarioType: z.literal(true),
});

export const aiNormalizedDraftSchema = z.object({
  method: endpointMethodSchema,
  path: z.string().min(1).startsWith('/'),
  description: z.string(),
  statusCode: z.number().int().min(100).max(599),
  responseBody: z.unknown(),
  scenarios: z.array(aiNormalizedScenarioSchema).min(1),
});

export const aiPreviewResponseSchema = aiNormalizedDraftSchema.extend({
  locks: aiDraftLocksSchema,
});

export type GenerateEndpointRequestInput = z.infer<typeof generateEndpointRequestSchema>;
export type AiRawGeneratedEndpointInput = z.infer<typeof aiRawGeneratedEndpointSchema>;
export type AiNormalizedDraftInput = z.infer<typeof aiNormalizedDraftSchema>;
export type AiPreviewResponseInput = z.infer<typeof aiPreviewResponseSchema>;
