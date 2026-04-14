import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import { listAuditEventsQuerySchema, projectParamsSchema } from './schema.js';
import { listProjectAuditEvents } from './service.js';

export const auditEventsRouter = Router({ mergeParams: true });

auditEventsRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectParamsSchema.parse(req.params);
    const query = listAuditEventsQuerySchema.parse(req.query);
    const result = await listProjectAuditEvents(actor, projectId, query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
