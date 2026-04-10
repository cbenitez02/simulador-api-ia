import type { RequestHandler } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { resolveActorIdentity } from './identity-resolver.js';
import { clerkRequestIdentityAdapter } from './providers/clerk.js';

const requestIdentityAdapters = [clerkRequestIdentityAdapter];

async function resolveRequestIdentity(req: Parameters<RequestHandler>[0]) {
  for (const adapter of requestIdentityAdapters) {
    const identity = await adapter.resolve(req);

    if (identity) {
      return identity;
    }
  }

  return null;
}

export const authenticateApiRequest: RequestHandler = async (req, _res, next) => {
  try {
    const identity = await resolveRequestIdentity(req);

    if (!identity) {
      throw new AppError(401, 'Authentication required', { code: 'AUTH_REQUIRED' });
    }

    req.auth = await resolveActorIdentity(identity);
    next();
  } catch (error) {
    next(error);
  }
};
