import { z } from 'zod';

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const listProjectLogsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(100),
    cursorCreatedAt: z.iso.datetime().optional(),
    cursorId: z.string().min(1).optional(),
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
