import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import { listProjectLogsQuerySchema, projectParamsSchema } from './schema.js';
import { clearProjectLogs, listProjectLogs } from './service.js';

export const logsRouter = Router({ mergeParams: true });

logsRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectParamsSchema.parse(req.params);
    const query = listProjectLogsQuerySchema.parse(req.query);
    const logs = await listProjectLogs(actor, projectId, query);
    res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
});

logsRouter.delete('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectParamsSchema.parse(req.params);
    await clearProjectLogs(actor, projectId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
