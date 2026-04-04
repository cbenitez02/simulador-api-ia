import { Router } from 'express';
import { createProjectSchema, projectParamsSchema, updateProjectSchema } from './schema.js';
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
    const projects = await listProjects();
    res.status(200).json(projects);
  } catch (error) {
    next(error);
  }
});

projectsRouter.post('/', async (req, res, next) => {
  try {
    const input = createProjectSchema.parse(req.body);
    const project = await createProject(input);

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

projectsRouter.get('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = projectParamsSchema.parse(req.params);
    const project = await getProjectById(projectId);
    res.status(200).json(project);
  } catch (error) {
    next(error);
  }
});

projectsRouter.patch('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = projectParamsSchema.parse(req.params);
    const input = updateProjectSchema.parse(req.body);

    const project = await updateProject(projectId, input);

    res.status(200).json(project);
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = projectParamsSchema.parse(req.params);
    await deleteProject(projectId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
