import { Injectable, inject } from '@angular/core';
import type { Clerk } from '@clerk/clerk-js/no-rhc';
import { FRONTEND_AUTH_CONFIG } from './auth.config';
import { loadClerkBrowser } from './clerk-browser.loader';
import { loadingFrontendAuthSnapshot, type FrontendAuthSnapshot } from './models/frontend-auth.model';
import type { FrontendAuthAdapter } from './ports/frontend-auth-adapter';

@Injectable()
export class ClerkFrontendAuthAdapter implements FrontendAuthAdapter {
  private readonly config = inject(FRONTEND_AUTH_CONFIG);
  private readonly listeners = new Set<(snapshot: FrontendAuthSnapshot) => void>();
  private clerk: Clerk | null = null;
  private snapshot: FrontendAuthSnapshot = loadingFrontendAuthSnapshot;

  async initialize(): Promise<void> {
    const publishableKey = this.config.clerkPublishableKey?.trim();

    if (!publishableKey) {
      this.updateSnapshot({
        state: 'misconfigured',
        userId: null,
        displayName: null,
        email: null,
        emailVerified: false,
        headers: null,
        reason: 'Missing Clerk publishable key in runtime config.',
      });
      return;
    }

    try {
      const module = await loadClerkBrowser();
      const clerk = new module.Clerk(publishableKey);
      await clerk.load();

      clerk.addListener(() => {
        this.updateSnapshot(this.mapSnapshot(clerk));
      });

      this.clerk = clerk;
      this.updateSnapshot(this.mapSnapshot(clerk));
    } catch (error) {
      this.updateSnapshot({
        state: 'error',
        userId: null,
        displayName: null,
        email: null,
        emailVerified: false,
        headers: null,
        reason: error instanceof Error ? error.message : 'Could not initialize Clerk.',
      });
    }
  }

  getSnapshot(): FrontendAuthSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: FrontendAuthSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async openSignIn(): Promise<void> {
    this.clerk?.redirectToSignIn({
      signInFallbackRedirectUrl: this.config.afterSignInUrl,
      signUpFallbackRedirectUrl: this.config.afterSignUpUrl,
    });
  }

  async signOut(): Promise<void> {
    if (!this.clerk) return;
    await this.clerk.signOut();
  }

  private updateSnapshot(snapshot: FrontendAuthSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  private mapSnapshot(clerk: Clerk): FrontendAuthSnapshot {
    if (!clerk.loaded) {
      return loadingFrontendAuthSnapshot;
    }

    const user = clerk.user;
    const primaryEmail = user?.primaryEmailAddress;
    const email = primaryEmail?.emailAddress ?? null;
    const emailVerified = primaryEmail?.verification.status === 'verified';
    const displayName = user?.fullName ?? email ?? user?.id ?? null;

    if (!clerk.isSignedIn || !user) {
      return {
        state: 'unauthenticated',
        userId: null,
        displayName: null,
        email: null,
        emailVerified: false,
        headers: null,
        reason: 'Sign in is required to use the management workspace.',
      };
    }

    return {
      state: 'authenticated',
      userId: user.id,
      displayName,
      email,
      emailVerified,
      headers: {
        authStatus: 'signed-in',
        userId: user.id,
        email: email ?? undefined,
        emailVerified,
        displayName: displayName ?? undefined,
      },
      reason: null,
    };
  }
}
