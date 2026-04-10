import { Injector, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { authGuard } from './auth.guard';
import { FrontendAuthSessionService } from './frontend-auth-session.service';

describe('authGuard', () => {
  it('redirects unauthenticated users to /auth', async () => {
    const router = {
      createUrlTree: vi.fn((segments: string[]) => ({ segments })),
    };
    const authSession = {
      bootstrap: vi.fn(async () => undefined),
      canAccessProtectedRoutes: vi.fn(() => false),
    };

    const injector = Injector.create({
      providers: [
        { provide: Router, useValue: router },
        { provide: FrontendAuthSessionService, useValue: authSession },
      ],
    });

    const result = await runInInjectionContext(injector, () => authGuard({} as never, {} as never));

    expect(authSession.bootstrap).toHaveBeenCalledOnce();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth']);
    expect(result).toEqual({ segments: ['/auth'] });
  });

  it('allows authenticated users through', async () => {
    const authSession = {
      bootstrap: vi.fn(async () => undefined),
      canAccessProtectedRoutes: vi.fn(() => true),
    };

    const injector = Injector.create({
      providers: [
        { provide: Router, useValue: { createUrlTree: vi.fn() } },
        { provide: FrontendAuthSessionService, useValue: authSession },
      ],
    });

    const result = await runInInjectionContext(injector, () => authGuard({} as never, {} as never));

    expect(result).toBe(true);
  });
});
