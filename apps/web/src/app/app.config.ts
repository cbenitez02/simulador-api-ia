import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideApiConfig } from './shared/config/api.config';
import { provideFrontendAuthConfig } from './shared/auth/auth.config';
import { authHttpInterceptor } from './shared/auth/auth-http.interceptor';
import { FRONTEND_AUTH_ADAPTER } from './shared/auth/frontend-auth-adapter.token';
import { ClerkFrontendAuthAdapter } from './shared/auth/clerk-frontend-auth.adapter';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authHttpInterceptor])),
    provideAnimations(),
    provideRouter(routes),
    provideApiConfig(),
    provideFrontendAuthConfig(),
    { provide: FRONTEND_AUTH_ADAPTER, useClass: ClerkFrontendAuthAdapter },
  ],
};
