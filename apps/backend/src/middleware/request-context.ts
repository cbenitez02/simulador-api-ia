import type { Request, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

type RequestWithRequestId = Request & { requestId?: string };

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const requestWithContext = req as RequestWithRequestId;
  const headerValue = req.header('x-request-id');
  const requestId = headerValue?.trim() || randomUUID();

  requestWithContext.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};
