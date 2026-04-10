import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import { dashboardProjectParamsSchema, dashboardSummarySchema } from './schema.js';
import { getProjectDashboardSummary } from './service.js';

export const dashboardRouter = Router({ mergeParams: true });

dashboardRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = dashboardProjectParamsSchema.parse(req.params);
    const summary = await getProjectDashboardSummary(actor, projectId);

    res.status(200).json(dashboardSummarySchema.parse(summary));
  } catch (error) {
    next(error);
  }
});
