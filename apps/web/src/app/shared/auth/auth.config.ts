import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { getAppRuntimeConfig } from '../config/app-runtime-config';

export interface FrontendAuthConfig {
  clerkPublishableKey?: string;
  afterSignInUrl: string;
  afterSignUpUrl: string;
}

export const FRONTEND_AUTH_CONFIG = new InjectionToken<FrontendAuthConfig>('FRONTEND_AUTH_CONFIG');

export function provideFrontendAuthConfig(
  config: FrontendAuthConfig = {
    clerkPublishableKey: getAppRuntimeConfig().clerkPublishableKey,
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/dashboard',
  },
): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: FRONTEND_AUTH_CONFIG, useValue: config }]);
}
