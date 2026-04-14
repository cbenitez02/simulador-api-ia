import { z } from 'zod';
import { endpointMethodSchema } from '../endpoints/schema.js';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export const logCursorDirectionSchema = z.enum(['older', 'newer']);
export const logStatusBucketSchema = z.enum(['2xx', '3xx', '4xx', '5xx']);

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const listProjectLogsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(100),
    direction: logCursorDirectionSchema.default('older'),
    cursorCreatedAt: z.iso.datetime().optional(),
    cursorId: z.string().min(1).optional(),
    method: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .transform((value) => value.toUpperCase())
        .pipe(endpointMethodSchema)
        .optional()
    ),
    statusBucket: z.preprocess(emptyStringToUndefined, logStatusBucketSchema.optional()),
    path: z.preprocess(emptyStringToUndefined, z.string().min(1).max(500).optional()),
  })
  .refine(
    (query) =>
      (query.cursorCreatedAt === undefined && query.cursorId === undefined) ||
      (query.cursorCreatedAt !== undefined && query.cursorId !== undefined),
    {
      message: 'cursorCreatedAt and cursorId must be provided together',
      path: ['cursorCreatedAt'],
    }
  );

export type ListProjectLogsQuery = z.infer<typeof listProjectLogsQuerySchema>;
