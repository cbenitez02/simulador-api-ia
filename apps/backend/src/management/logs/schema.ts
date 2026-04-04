import { z } from 'zod';

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});
