import { z } from 'zod';

export const workspaceRoleSchema = z.enum(['owner', 'editor', 'viewer']);

export const workspaceParamsSchema = z.object({
  workspaceId: z.string().min(1),
});

export const workspaceMemberParamsSchema = workspaceParamsSchema.extend({
  memberUserId: z.string().min(1),
});

export const addWorkspaceMemberSchema = z.object({
  email: z.string().email().max(320),
  role: workspaceRoleSchema,
});

export const updateWorkspaceMemberRoleSchema = z.object({
  role: workspaceRoleSchema,
});

export const workspaceMemberResponseSchema = z.object({
  userId: z.string(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  role: workspaceRoleSchema,
  createdAt: z.string().datetime(),
});

export const workspaceMembersListSchema = z.object({
  items: z.array(workspaceMemberResponseSchema),
});

export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type UpdateWorkspaceMemberRoleInput = z.infer<typeof updateWorkspaceMemberRoleSchema>;
