import { z } from 'zod';

const workspaceRoleSchema = z.enum(['owner', 'editor', 'viewer']);
const workspaceKindSchema = z.enum(['personal', 'team']);

export const workspaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: workspaceKindSchema,
  role: workspaceRoleSchema,
  isPersonal: z.boolean(),
  capabilities: z.object({
    canEdit: z.boolean(),
    canManageMembers: z.boolean(),
    canRestoreSnapshots: z.boolean(),
    canImportContracts: z.boolean(),
  }),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const workspaceListSchema = z.object({
  items: z.array(workspaceSummarySchema),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
