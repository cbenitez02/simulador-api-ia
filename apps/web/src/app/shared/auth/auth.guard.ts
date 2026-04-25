import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { FrontendAuthSessionService } from './frontend-auth-session.service';

export const authGuard: CanActivateFn = async () => {
  const authSession = inject(FrontendAuthSessionService);
  const router = inject(Router);

  await authSession.bootstrap();

  if (authSession.canAccessProtectedRoutes()) {
    return true;
  }

  if (authSession.snapshot().state === 'unauthenticated' && authSession.accessState() !== 'unauthorized') {
    await authSession.openSignIn();
    return false;
  }

  return router.createUrlTree(['/auth']);
};
