import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import { generateEndpointPreview, generateEndpointWithAi } from './service.js';
import { aiPromptRequestSchema, projectParamsSchema } from './schema.js';

export const aiRouter = Router({ mergeParams: true });

aiRouter.post('/ai-preview', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectParamsSchema.parse(req.params);
    const { prompt } = aiPromptRequestSchema.parse(req.body);
    const preview = await generateEndpointPreview(actor, projectId, prompt);

    res.status(200).json(preview);
  } catch (error) {
    next(error);
  }
});

aiRouter.post('/ai-generate', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectParamsSchema.parse(req.params);
    const { prompt } = aiPromptRequestSchema.parse(req.body);
    const endpoint = await generateEndpointWithAi(actor, projectId, prompt);

    res.status(201).json(endpoint);
  } catch (error) {
    next(error);
  }
});
