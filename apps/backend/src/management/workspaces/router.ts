import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import { createWorkspaceSchema, workspaceListSchema, workspaceSummarySchema } from './schema.js';
import { createWorkspace, listWorkspaces } from './service.js';

export const workspacesRouter = Router();

workspacesRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const workspaces = await listWorkspaces(actor);
    res.status(200).json(workspaceListSchema.parse(workspaces));
  } catch (error) {
    next(error);
  }
});

workspacesRouter.post('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const input = createWorkspaceSchema.parse(req.body);
    const workspace = await createWorkspace(actor, input);
    res.status(201).json(workspaceSummarySchema.parse(workspace));
  } catch (error) {
    next(error);
  }
});
