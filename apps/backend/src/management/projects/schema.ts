import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const listProjectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.preprocess(emptyStringToUndefined, z.string().min(1).max(100).optional()),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  workspaceId: z.string().min(1).optional(),
});

export const updateProjectSchema = createProjectSchema
  .extend({
    slug: z.string().trim().min(1).max(100).optional(),
  })
  .partial()
  .refine(
    (input) =>
      input.name !== undefined ||
      input.description !== undefined ||
      input.slug !== undefined ||
      input.workspaceId !== undefined,
    {
      message: 'At least one field (name, description, slug or workspaceId) is required',
    }
  );

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectParamsInput = z.infer<typeof projectParamsSchema>;
export type ListProjectsQueryInput = z.infer<typeof listProjectsQuerySchema>;
