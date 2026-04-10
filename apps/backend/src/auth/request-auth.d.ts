import type { AuthenticatedActor } from './types.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedActor;
    }
  }
}

export {};
