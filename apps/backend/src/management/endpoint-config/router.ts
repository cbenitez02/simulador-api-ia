import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import { endpointParamsSchema, upsertEndpointConfigSchema } from './schema.js';
import { getEndpointConfig, upsertEndpointConfig } from './service.js';

export const endpointConfigRouter = Router({ mergeParams: true });

endpointConfigRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { endpointId } = endpointParamsSchema.parse(req.params);
    const config = await getEndpointConfig(actor, endpointId);

    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
});

endpointConfigRouter.put('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { endpointId } = endpointParamsSchema.parse(req.params);
    const input = upsertEndpointConfigSchema.parse(req.body);
    const config = await upsertEndpointConfig(actor, endpointId, input);

    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
});
