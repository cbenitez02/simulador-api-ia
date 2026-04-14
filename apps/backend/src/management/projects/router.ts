import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectParamsSchema,
  updateProjectSchema,
} from './schema.js';
import {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  updateProject,
} from './service.js';

export const projectsRouter = Router();

projectsRouter.get('/', async (_req, res, next) => {
  try {
    const actor = requireRequestActor(_req);
    const query = listProjectsQuerySchema.parse(_req.query);
    const projects = await listProjects(actor, query);
    res.status(200).json(projects);
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const input = createProjectSchema.parse(req.body);
    const project = await createProject(actor, input);

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

projectsRouter.get('/:projectId', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectParamsSchema.parse(req.params);
    const project = await getProjectById(actor, projectId);
    res.status(200).json(project);
  } catch (error) {
    next(error);
  }
});

projectsRouter.patch('/:projectId', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectParamsSchema.parse(req.params);
    const input = updateProjectSchema.parse(req.body);

    const project = await updateProject(actor, projectId, input);

    res.status(200).json(project);
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/:projectId', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectParamsSchema.parse(req.params);
    await deleteProject(actor, projectId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
