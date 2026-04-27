import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import {
  acceptWorkspaceInvitationResponseSchema,
  createWorkspaceInvitationSchema,
  workspaceInvitationParamsSchema,
  workspaceInvitationResponseSchema,
  workspaceInvitationWorkspaceMemberParamsSchema,
  workspaceInvitationWorkspaceParamsSchema,
  workspaceInvitationsListSchema,
} from './schema.js';
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  listPendingWorkspaceInvitations,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from './service.js';

export const workspaceInvitationsRouter = Router();
export const workspaceScopedInvitationsRouter = Router({ mergeParams: true });

workspaceScopedInvitationsRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { workspaceId } = workspaceInvitationWorkspaceParamsSchema.parse(req.params);
    const invitations = await listWorkspaceInvitations(actor, workspaceId);

    res.status(200).json(workspaceInvitationsListSchema.parse(invitations));
  } catch (error) {
    next(error);
  }
});

workspaceScopedInvitationsRouter.post('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { workspaceId } = workspaceInvitationWorkspaceParamsSchema.parse(req.params);
    const input = createWorkspaceInvitationSchema.parse(req.body);
    const invitation = await createWorkspaceInvitation(actor, workspaceId, input);

    res.status(201).json(workspaceInvitationResponseSchema.parse(invitation));
  } catch (error) {
    next(error);
  }
});

workspaceScopedInvitationsRouter.delete('/:invitationId', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { workspaceId, invitationId } = workspaceInvitationWorkspaceMemberParamsSchema.parse(
      req.params
    );
    await revokeWorkspaceInvitation(actor, workspaceId, invitationId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

workspaceInvitationsRouter.get('/pending', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const invitations = await listPendingWorkspaceInvitations(actor);

    res.status(200).json(workspaceInvitationsListSchema.parse(invitations));
  } catch (error) {
    next(error);
  }
});

workspaceInvitationsRouter.post('/:invitationId/accept', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { invitationId } = workspaceInvitationParamsSchema.parse(req.params);
    const result = await acceptWorkspaceInvitation(actor, invitationId);

    res.status(200).json(acceptWorkspaceInvitationResponseSchema.parse(result));
  } catch (error) {
    next(error);
  }
});
