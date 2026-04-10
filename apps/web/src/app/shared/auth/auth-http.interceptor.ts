import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { FrontendAuthSessionService } from './frontend-auth-session.service';

export const authHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const authSession = inject(FrontendAuthSessionService);
  const headers = authSession.snapshot().headers;

  if (!headers) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        'x-clerk-auth-status': headers.authStatus,
        'x-clerk-user-id': headers.userId,
        'x-clerk-email': headers.email ?? '',
        'x-clerk-email-verified': String(headers.emailVerified),
        'x-clerk-display-name': headers.displayName ?? '',
      },
    }),
  );
};
