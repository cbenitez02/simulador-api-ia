import { Injector, signal, runInInjectionContext } from '@angular/core';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { authGuard } from './auth.guard';
import { FrontendAuthSessionService } from './frontend-auth-session.service';

describe('authGuard', () => {
  function createAuthSession(options?: {
    canAccessProtectedRoutes?: boolean;
    snapshotState?: 'authenticated' | 'unauthenticated' | 'misconfigured' | 'error' | 'loading';
    accessState?: 'ready' | 'unauthenticated' | 'unauthorized';
  }) {
    return {
      snapshot: signal({
        state: options?.snapshotState ?? 'authenticated',
        userId: null,
        displayName: null,
        username: null,
        avatarUrl: null,
        email: null,
        emailVerified: false,
        headers: null,
        reason: null,
      }),
      accessState: signal(options?.accessState ?? 'ready'),
      bootstrap: vi.fn(async () => undefined),
      openSignIn: vi.fn(async () => undefined),
      canAccessProtectedRoutes: vi.fn(() => options?.canAccessProtectedRoutes ?? false),
    };
  }

  it('allows authenticated users through', async () => {
    const authSession = createAuthSession({
      canAccessProtectedRoutes: true,
      snapshotState: 'authenticated',
    });

    const injector = Injector.create({
      providers: [
        { provide: Router, useValue: { createUrlTree: vi.fn() } },
        { provide: FrontendAuthSessionService, useValue: authSession },
      ],
    });

    const result = await runInInjectionContext(injector, () => authGuard({} as never, {} as never));

    expect(authSession.bootstrap).toHaveBeenCalledOnce();
    expect(authSession.openSignIn).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('opens Clerk sign-in directly when unauthenticated', async () => {
    const router = {
      createUrlTree: vi.fn((segments: string[]) => ({ segments })),
    };
    const authSession = createAuthSession({
      canAccessProtectedRoutes: false,
      snapshotState: 'unauthenticated',
      accessState: 'ready',
    });

    const injector = Injector.create({
      providers: [
        { provide: Router, useValue: router },
        { provide: FrontendAuthSessionService, useValue: authSession },
      ],
    });

    const result = await runInInjectionContext(injector, () => authGuard({} as never, {} as never));

    expect(authSession.bootstrap).toHaveBeenCalledOnce();
    expect(authSession.openSignIn).toHaveBeenCalledOnce();
    expect(router.createUrlTree).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('keeps the /auth fallback for misconfigured or failed auth states', async () => {
    const router = {
      createUrlTree: vi.fn((segments: string[]) => ({ segments })),
    };
    const authSession = createAuthSession({
      canAccessProtectedRoutes: false,
      snapshotState: 'misconfigured',
    });

    const injector = Injector.create({
      providers: [
        { provide: Router, useValue: router },
        { provide: FrontendAuthSessionService, useValue: authSession },
      ],
    });

    const result = await runInInjectionContext(injector, () => authGuard({} as never, {} as never));

    expect(authSession.bootstrap).toHaveBeenCalledOnce();
    expect(authSession.openSignIn).not.toHaveBeenCalled();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth']);
    expect(result).toEqual({ segments: ['/auth'] });
  });

  it('keeps the /auth fallback when access is unauthorized', async () => {
    const router = {
      createUrlTree: vi.fn((segments: string[]) => ({ segments })),
    };
    const authSession = createAuthSession({
      canAccessProtectedRoutes: false,
      snapshotState: 'unauthenticated',
      accessState: 'unauthorized',
    });

    const injector = Injector.create({
      providers: [
        { provide: Router, useValue: router },
        { provide: FrontendAuthSessionService, useValue: authSession },
      ],
    });

    const result = await runInInjectionContext(injector, () => authGuard({} as never, {} as never));

    expect(authSession.openSignIn).not.toHaveBeenCalled();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth']);
    expect(result).toEqual({ segments: ['/auth'] });
  });
});
