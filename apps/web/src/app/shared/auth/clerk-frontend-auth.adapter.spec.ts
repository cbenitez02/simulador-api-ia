import { Injector, runInInjectionContext } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FRONTEND_AUTH_CONFIG } from './auth.config';
import { ClerkFrontendAuthAdapter } from './clerk-frontend-auth.adapter';

const { loadClerkBrowserMock } = vi.hoisted(() => ({
  loadClerkBrowserMock: vi.fn(),
}));

vi.mock('./clerk-browser.loader', () => ({
  loadClerkBrowser: loadClerkBrowserMock,
}));

describe('ClerkFrontendAuthAdapter', () => {
  beforeEach(() => {
    loadClerkBrowserMock.mockReset();
  });

  function createAdapter(config: { clerkPublishableKey?: string } = {}) {
    const injector = Injector.create({
      providers: [
        ClerkFrontendAuthAdapter,
        {
          provide: FRONTEND_AUTH_CONFIG,
          useValue: {
            clerkPublishableKey: config.clerkPublishableKey,
            afterSignInUrl: '/dashboard',
            afterSignUpUrl: '/dashboard',
          },
        },
      ],
    });

    return runInInjectionContext(injector, () => injector.get(ClerkFrontendAuthAdapter));
  }

  it('reports misconfigured when the runtime config does not provide a Clerk key', async () => {
    const adapter = createAdapter();

    await adapter.initialize();

    expect(adapter.getSnapshot()).toMatchObject({
      state: 'misconfigured',
      reason: 'Missing Clerk publishable key in runtime config.',
    });
  });

  it('maps the signed-in Clerk user into backend auth headers', async () => {
    const addListener = vi.fn();
    const clerkInstance = {
      loaded: true,
      isSignedIn: true,
      user: {
        id: 'user_clerk_123',
        fullName: 'Owner User',
        username: 'owner.user',
        imageUrl: 'https://cdn.clerk.dev/avatar.png',
        primaryEmailAddress: {
          emailAddress: 'owner@example.com',
          verification: { status: 'verified' },
        },
      },
      addListener,
      load: vi.fn(async () => undefined),
      redirectToSignIn: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
    };

    loadClerkBrowserMock.mockResolvedValue({
      Clerk: class ClerkMock {
        constructor() {
          return clerkInstance as never;
        }
      },
    });

    const adapter = createAdapter({ clerkPublishableKey: 'pk_test_123' });
    await adapter.initialize();

    expect(adapter.getSnapshot()).toMatchObject({
      state: 'authenticated',
      userId: 'user_clerk_123',
      email: 'owner@example.com',
      displayName: 'Owner User',
      username: 'owner.user',
      avatarUrl: 'https://cdn.clerk.dev/avatar.png',
      headers: {
        authStatus: 'signed-in',
        userId: 'user_clerk_123',
        email: 'owner@example.com',
        emailVerified: true,
        displayName: 'Owner User',
      },
    });
    expect(addListener).toHaveBeenCalledOnce();
  });
});
