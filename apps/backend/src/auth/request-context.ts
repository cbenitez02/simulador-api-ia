import type { Request } from 'express';
import { AppError } from '../middleware/error-handler.js';
import type { AuthenticatedActor } from './types.js';

export function requireRequestActor(req: Request): AuthenticatedActor {
  if (!req.auth) {
    throw new AppError(401, 'Authentication required', { code: 'AUTH_REQUIRED' });
  }

  return req.auth;
}
