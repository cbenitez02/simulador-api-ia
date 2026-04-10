import { inject } from '@angular/core';
import type { CanActivateFn} from '@angular/router';
import { Router } from '@angular/router';
import { FrontendAuthSessionService } from './frontend-auth-session.service';

export const authGuard: CanActivateFn = async () => {
  const authSession = inject(FrontendAuthSessionService);
  const router = inject(Router);

  await authSession.bootstrap();

  return authSession.canAccessProtectedRoutes() ? true : router.createUrlTree(['/auth']);
};
