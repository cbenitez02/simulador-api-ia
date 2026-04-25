import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export const supportedEndpointMethods = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
] as const;

export const endpointMethodSchema = z.enum(supportedEndpointMethods);

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const endpointParamsSchema = z.object({
  projectId: z.string().min(1),
  endpointId: z.string().min(1),
});

export const listEndpointsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.preprocess(emptyStringToUndefined, z.string().min(1).max(200).optional()),
  method: z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .transform((value) => value.toUpperCase())
      .pipe(endpointMethodSchema)
      .optional()
  ),
  sort: z.enum(['path-asc', 'path-desc', 'method']).default('path-asc'),
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
export type ListEndpointsQueryInput = z.infer<typeof listEndpointsQuerySchema>;
