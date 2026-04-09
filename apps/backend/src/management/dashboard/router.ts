import { Router } from 'express';
import { dashboardProjectParamsSchema, dashboardSummarySchema } from './schema.js';
import { getProjectDashboardSummary } from './service.js';

export const dashboardRouter = Router({ mergeParams: true });

dashboardRouter.get('/', async (req, res, next) => {
  try {
    const { projectId } = dashboardProjectParamsSchema.parse(req.params);
    const summary = await getProjectDashboardSummary(projectId);

    res.status(200).json(dashboardSummarySchema.parse(summary));
  } catch (error) {
    next(error);
  }
});
