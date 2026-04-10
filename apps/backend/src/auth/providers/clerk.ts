import type { Request } from 'express';
import type { RequestIdentityAdapter } from './types.js';

function readTrimmedHeader(req: Request, name: string): string | undefined {
  const value = req.get(name)?.trim();
  return value ? value : undefined;
}

function parseBooleanHeader(req: Request, name: string): boolean {
  return req.get(name)?.trim().toLowerCase() === 'true';
}

export const clerkRequestIdentityAdapter: RequestIdentityAdapter = {
  provider: 'clerk',
  resolve(req) {
    if (readTrimmedHeader(req, 'x-clerk-auth-status') !== 'signed-in') {
      return null;
    }

    const subject = readTrimmedHeader(req, 'x-clerk-user-id');

    if (!subject) {
      return null;
    }

    return {
      provider: 'clerk',
      subject,
      email: readTrimmedHeader(req, 'x-clerk-email'),
      emailVerified: parseBooleanHeader(req, 'x-clerk-email-verified'),
      displayName: readTrimmedHeader(req, 'x-clerk-display-name'),
    };
  },
};
