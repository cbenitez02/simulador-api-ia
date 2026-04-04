import { Router } from 'express';
import {
  createEndpointSchema,
  endpointParamsSchema,
  projectParamsSchema,
  updateEndpointSchema,
} from './schema.js';
import {
  createEndpoint,
  deleteEndpoint,
  getEndpointById,
  listEndpoints,
  updateEndpoint,
} from './service.js';

export const endpointsRouter = Router({ mergeParams: true });

endpointsRouter.get('/', async (req, res, next) => {
  try {
    const { projectId } = projectParamsSchema.parse(req.params);
    const endpoints = await listEndpoints(projectId);

    res.status(200).json(endpoints);
  } catch (error) {
    next(error);
  }
});

endpointsRouter.post('/', async (req, res, next) => {
  try {
    const { projectId } = projectParamsSchema.parse(req.params);
    const input = createEndpointSchema.parse(req.body);
    const endpoint = await createEndpoint(projectId, input);

    res.status(201).json(endpoint);
  } catch (error) {
    next(error);
  }
});

endpointsRouter.get('/:endpointId', async (req, res, next) => {
  try {
    const { projectId, endpointId } = endpointParamsSchema.parse(req.params);
    const endpoint = await getEndpointById(projectId, endpointId);

    res.status(200).json(endpoint);
  } catch (error) {
    next(error);
  }
});

endpointsRouter.patch('/:endpointId', async (req, res, next) => {
  try {
    const { projectId, endpointId } = endpointParamsSchema.parse(req.params);
    const input = updateEndpointSchema.parse(req.body);
    const endpoint = await updateEndpoint(projectId, endpointId, input);

    res.status(200).json(endpoint);
  } catch (error) {
    next(error);
  }
});

endpointsRouter.delete('/:endpointId', async (req, res, next) => {
  try {
    const { projectId, endpointId } = endpointParamsSchema.parse(req.params);
    await deleteEndpoint(projectId, endpointId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
