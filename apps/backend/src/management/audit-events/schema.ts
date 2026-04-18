import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export const auditEventDirectionSchema = z.enum(['older', 'newer']);
export const auditEventResourceTypeSchema = z.enum([
  'project',
  'endpoint',
  'scenario',
  'global-config',
  'endpoint-config',
  'snapshot',
]);
export const auditEventActionSchema = z.enum(['created', 'updated', 'deleted', 'restored']);

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const listAuditEventsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    direction: auditEventDirectionSchema.default('older'),
    cursorCreatedAt: z.iso.datetime().optional(),
    cursorId: z.string().min(1).optional(),
    resourceType: z.preprocess(emptyStringToUndefined, auditEventResourceTypeSchema.optional()),
    action: z.preprocess(emptyStringToUndefined, auditEventActionSchema.optional()),
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

export type AuditEventAction = z.infer<typeof auditEventActionSchema>;
export type AuditEventResourceType = z.infer<typeof auditEventResourceTypeSchema>;
export type ListAuditEventsQuery = z.infer<typeof listAuditEventsQuerySchema>;
