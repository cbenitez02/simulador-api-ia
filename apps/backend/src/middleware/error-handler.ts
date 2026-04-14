import type { ErrorRequestHandler, Request } from 'express';
import { ZodError } from 'zod';

type RequestWithRequestId = Request & { requestId?: string };

function emitStructuredErrorLog(err: unknown, requestId: string | null): void {
  const payload = {
    level: 'error',
    event: 'unhandled_error',
    requestId,
    message: err instanceof Error ? err.message : 'Unknown error',
    name: err instanceof Error ? err.name : 'UnknownError',
  };

  console.error(JSON.stringify(payload));
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly options?: {
      code?: string;
      retryable?: boolean;
      details?: unknown;
    }
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function isPrismaKnownError(err: unknown): err is { code: string; meta?: { target?: unknown } } {
  if (typeof err !== 'object' || err === null) return false;

  return 'code' in err && typeof (err as { code?: unknown }).code === 'string';
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  void _next;
  const requestWithContext = req as RequestWithRequestId;

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });

    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.options?.code ? { code: err.options.code } : {}),
      ...(typeof err.options?.retryable === 'boolean' ? { retryable: err.options.retryable } : {}),
      ...(err.options?.details !== undefined ? { details: err.options.details } : {}),
    });
    return;
  }

  if (isPrismaKnownError(err) && err.code === 'P2002') {
    res.status(409).json({
      error: 'Resource already exists',
      fields: err.meta?.target,
    });

    return;
  }

  if (isPrismaKnownError(err) && err.code === 'P2025') {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  emitStructuredErrorLog(err, requestWithContext.requestId ?? null);
  res.status(500).json({ error: 'Internal Server Error' });
};
