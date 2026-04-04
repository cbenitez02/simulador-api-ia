import { Router } from 'express';
import { generateEndpointWithAi } from './service.js';
import { generateEndpointRequestSchema, projectParamsSchema } from './schema.js';

export const aiRouter = Router({ mergeParams: true });

aiRouter.post('/', async (req, res, next) => {
  try {
    const { projectId } = projectParamsSchema.parse(req.params);
    const { prompt } = generateEndpointRequestSchema.parse(req.body);
    const endpoint = await generateEndpointWithAi(projectId, prompt);

    res.status(201).json(endpoint);
  } catch (error) {
    next(error);
  }
});
