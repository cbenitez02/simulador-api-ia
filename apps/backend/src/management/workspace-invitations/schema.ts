import { z } from 'zod';
import { workspaceRoleSchema } from '../workspace-members/schema.js';

export const workspaceInvitationStatusSchema = z.enum(['pending', 'accepted', 'revoked']);
export const workspaceInvitationRoleSchema = z.enum(['viewer', 'editor']);

export const workspaceInvitationParamsSchema = z.object({
  invitationId: z.string().min(1),
});

export const workspaceInvitationWorkspaceParamsSchema = z.object({
  workspaceId: z.string().min(1),
});

export const workspaceInvitationWorkspaceMemberParamsSchema =
  workspaceInvitationWorkspaceParamsSchema.extend({
    invitationId: z.string().min(1),
  });

export const createWorkspaceInvitationSchema = z.object({
  email: z.string().email().max(320),
  role: workspaceInvitationRoleSchema,
});

export const workspaceInvitationResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  email: z.string().email(),
  role: workspaceRoleSchema,
  status: workspaceInvitationStatusSchema,
  createdAt: z.string().datetime(),
});

export const workspaceInvitationsListSchema = z.object({
  items: z.array(workspaceInvitationResponseSchema),
});

export const acceptWorkspaceInvitationResponseSchema = z.object({
  accepted: z.literal(true),
});

export type CreateWorkspaceInvitationInput = z.infer<typeof createWorkspaceInvitationSchema>;
