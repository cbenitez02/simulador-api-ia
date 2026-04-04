import { Router } from 'express';
import { endpointParamsSchema, upsertEndpointConfigSchema } from './schema.js';
import { getEndpointConfig, upsertEndpointConfig } from './service.js';

export const endpointConfigRouter = Router({ mergeParams: true });

endpointConfigRouter.get('/', async (req, res, next) => {
  try {
    const { endpointId } = endpointParamsSchema.parse(req.params);
    const config = await getEndpointConfig(endpointId);

    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
});

endpointConfigRouter.put('/', async (req, res, next) => {
  try {
    const { endpointId } = endpointParamsSchema.parse(req.params);
    const input = upsertEndpointConfigSchema.parse(req.body);
    const config = await upsertEndpointConfig(endpointId, input);

    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
});
