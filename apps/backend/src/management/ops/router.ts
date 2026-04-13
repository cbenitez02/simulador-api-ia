import { Router } from 'express';
import { getOperationalHealth } from './service.js';

export const opsRouter = Router();

opsRouter.get('/health', async (_req, res, next) => {
  try {
    const payload = await getOperationalHealth();
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});
