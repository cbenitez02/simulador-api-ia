import { z } from 'zod';

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const snapshotParamsSchema = z.object({
  projectId: z.string().min(1),
  snapshotId: z.string().min(1),
});

export const createProjectSnapshotSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

export const restoreProjectSnapshotSchema = z.object({}).default({});

export type CreateProjectSnapshotInput = z.infer<typeof createProjectSnapshotSchema>;
