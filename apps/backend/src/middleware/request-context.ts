import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const headerValue = req.header('x-request-id');
  const requestId = headerValue?.trim() || randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};
