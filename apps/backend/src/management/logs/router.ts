import { Router } from 'express';
import { projectParamsSchema } from './schema.js';
import { clearProjectLogs, listProjectLogs } from './service.js';

export const logsRouter = Router({ mergeParams: true });

logsRouter.get('/', async (req, res, next) => {
  try {
    const { projectId } = projectParamsSchema.parse(req.params);
    const logs = await listProjectLogs(projectId);
    res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
});

logsRouter.delete('/', async (req, res, next) => {
  try {
    const { projectId } = projectParamsSchema.parse(req.params);
    await clearProjectLogs(projectId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
