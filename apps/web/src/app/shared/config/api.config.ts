import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { getAppRuntimeConfig } from './app-runtime-config';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

export function provideApiConfig(baseUrl = getAppRuntimeConfig().apiBaseUrl): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: API_BASE_URL, useValue: baseUrl.replace(/\/$/, '') }]);
}
