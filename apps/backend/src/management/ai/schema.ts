import { z } from 'zod';
import { endpointMethodSchema } from '../endpoints/schema.js';

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const generateEndpointRequestSchema = z.object({
  prompt: z.string().min(10).max(500),
});

export const aiGeneratedScenarioSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['success', 'error', 'edge-case', 'timeout', 'empty']),
  statusCode: z.number().int().min(100).max(599),
  body: z.unknown(),
  delayMs: z.number().int().min(0).max(30000).default(0),
  weight: z.number().int().min(1).default(1),
});

export const aiGeneratedEndpointSchema = z.object({
  method: endpointMethodSchema,
  path: z.string().min(1).startsWith('/'),
  description: z.string(),
  statusCode: z.number().int().min(100).max(599),
  responseBody: z.unknown(),
  scenarios: z.array(aiGeneratedScenarioSchema).min(1),
});

export type GenerateEndpointRequestInput = z.infer<typeof generateEndpointRequestSchema>;
export type AiGeneratedEndpointInput = z.infer<typeof aiGeneratedEndpointSchema>;
