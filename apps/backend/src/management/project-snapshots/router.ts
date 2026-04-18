import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import {
  createProjectSnapshotSchema,
  projectParamsSchema,
  restoreProjectSnapshotSchema,
  snapshotParamsSchema,
} from './schema.js';
import {
  createProjectSnapshot,
  getProjectSnapshotDetail,
  listProjectSnapshots,
  restoreProjectSnapshot,
} from './service.js';

export const projectSnapshotsRouter = Router({ mergeParams: true });

projectSnapshotsRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectParamsSchema.parse(req.params);
    res.status(200).json(await listProjectSnapshots(actor, projectId));
  } catch (error) {
    next(error);
  }
});

projectSnapshotsRouter.post('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectParamsSchema.parse(req.params);
    const input = createProjectSnapshotSchema.parse(req.body);
    res.status(201).json(await createProjectSnapshot(actor, projectId, input));
  } catch (error) {
    next(error);
  }
});

projectSnapshotsRouter.get('/:snapshotId', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId, snapshotId } = snapshotParamsSchema.parse(req.params);
    res.status(200).json(await getProjectSnapshotDetail(actor, projectId, snapshotId));
  } catch (error) {
    next(error);
  }
});

projectSnapshotsRouter.post('/:snapshotId/restore', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId, snapshotId } = snapshotParamsSchema.parse(req.params);
    restoreProjectSnapshotSchema.parse(req.body ?? {});
    res.status(200).json(await restoreProjectSnapshot(actor, projectId, snapshotId));
  } catch (error) {
    next(error);
  }
});
