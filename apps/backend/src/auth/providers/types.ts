import type { Request } from 'express';
import type { ResolvedExternalIdentity } from '../types.js';

export interface RequestIdentityAdapter {
  provider: string;
  resolve(req: Request): Promise<ResolvedExternalIdentity | null> | ResolvedExternalIdentity | null;
}
