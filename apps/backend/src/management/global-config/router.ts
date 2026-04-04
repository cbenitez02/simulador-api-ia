import { Router } from 'express';
import { projectParamsSchema, upsertGlobalConfigSchema } from './schema.js';
import { getGlobalConfig, upsertGlobalConfig } from './service.js';

export const globalConfigRouter = Router({ mergeParams: true });

globalConfigRouter.get('/', async (req, res, next) => {
  try {
    const { projectId } = projectParamsSchema.parse(req.params);
    const config = await getGlobalConfig(projectId);

    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
});

globalConfigRouter.put('/', async (req, res, next) => {
  try {
    const { projectId } = projectParamsSchema.parse(req.params);
    const input = upsertGlobalConfigSchema.parse(req.body);
    const config = await upsertGlobalConfig(projectId, input);

    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
});
