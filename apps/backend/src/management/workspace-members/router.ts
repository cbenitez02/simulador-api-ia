import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import {
  addWorkspaceMemberSchema,
  updateWorkspaceMemberRoleSchema,
  workspaceMemberParamsSchema,
  workspaceMemberResponseSchema,
  workspaceMembersListSchema,
  workspaceParamsSchema,
} from './schema.js';
import {
  addWorkspaceMember,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from './service.js';

export const workspaceMembersRouter = Router({ mergeParams: true });

workspaceMembersRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { workspaceId } = workspaceParamsSchema.parse(req.params);
    const members = await listWorkspaceMembers(actor, workspaceId);

    res.status(200).json(workspaceMembersListSchema.parse(members));
  } catch (error) {
    next(error);
  }
});

workspaceMembersRouter.post('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { workspaceId } = workspaceParamsSchema.parse(req.params);
    const input = addWorkspaceMemberSchema.parse(req.body);
    const member = await addWorkspaceMember(actor, workspaceId, input);

    res.status(201).json(workspaceMemberResponseSchema.parse(member));
  } catch (error) {
    next(error);
  }
});

workspaceMembersRouter.delete('/:memberUserId', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { workspaceId, memberUserId } = workspaceMemberParamsSchema.parse(req.params);
    await removeWorkspaceMember(actor, workspaceId, memberUserId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

workspaceMembersRouter.patch('/:memberUserId', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { workspaceId, memberUserId } = workspaceMemberParamsSchema.parse(req.params);
    const input = updateWorkspaceMemberRoleSchema.parse(req.body);
    const member = await updateWorkspaceMemberRole(actor, workspaceId, memberUserId, input);

    res.status(200).json(workspaceMemberResponseSchema.parse(member));
  } catch (error) {
    next(error);
  }
});
