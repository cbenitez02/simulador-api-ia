import { z } from 'zod';

export const endpointMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const endpointParamsSchema = z.object({
  projectId: z.string().min(1),
  endpointId: z.string().min(1),
});

export const createEndpointSchema = z.object({
  method: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(endpointMethodSchema),
  path: z.string().min(1).startsWith('/'),
  description: z.string().max(500).optional(),
  statusCode: z.number().int().min(100).max(599).default(200),
  responseBody: z.unknown().default({}),
});

export const updateEndpointSchema = z
  .object({
    description: z.string().max(500).optional(),
    statusCode: z.number().int().min(100).max(599).optional(),
    responseBody: z.unknown().optional(),
  })
  .refine(
    (input) =>
      input.description !== undefined ||
      input.statusCode !== undefined ||
      input.responseBody !== undefined,
    {
      message: 'At least one field (description, statusCode, responseBody) is required',
    }
  );

export type CreateEndpointInput = z.infer<typeof createEndpointSchema>;
export type UpdateEndpointInput = z.infer<typeof updateEndpointSchema>;
