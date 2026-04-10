import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import {
  createScenarioSchema,
  endpointParamsSchema,
  scenarioParamsSchema,
  updateScenarioSchema,
} from './schema.js';
import { createScenario, deleteScenario, listScenarios, updateScenario } from './service.js';

export const scenariosRouter = Router({ mergeParams: true });

scenariosRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { endpointId } = endpointParamsSchema.parse(req.params);
    const scenarios = await listScenarios(actor, endpointId);

    res.status(200).json(scenarios);
  } catch (error) {
    next(error);
  }
});

scenariosRouter.post('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { endpointId } = endpointParamsSchema.parse(req.params);
    const input = createScenarioSchema.parse(req.body);
    const scenario = await createScenario(actor, endpointId, input);

    res.status(201).json(scenario);
  } catch (error) {
    next(error);
  }
});

scenariosRouter.patch('/:scenarioId', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { endpointId, scenarioId } = scenarioParamsSchema.parse(req.params);
    const input = updateScenarioSchema.parse(req.body);
    const scenario = await updateScenario(actor, endpointId, scenarioId, input);

    res.status(200).json(scenario);
  } catch (error) {
    next(error);
  }
});

scenariosRouter.delete('/:scenarioId', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { endpointId, scenarioId } = scenarioParamsSchema.parse(req.params);
    await deleteScenario(actor, endpointId, scenarioId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
