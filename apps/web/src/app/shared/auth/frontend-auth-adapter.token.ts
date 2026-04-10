import { InjectionToken } from '@angular/core';
import type { FrontendAuthAdapter } from './ports/frontend-auth-adapter';

export const FRONTEND_AUTH_ADAPTER = new InjectionToken<FrontendAuthAdapter>('FRONTEND_AUTH_ADAPTER');
