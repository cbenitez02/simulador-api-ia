import { z } from 'zod';

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((input) => input.name !== undefined || input.description !== undefined, {
    message: 'At least one field (name or description) is required',
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectParamsInput = z.infer<typeof projectParamsSchema>;
