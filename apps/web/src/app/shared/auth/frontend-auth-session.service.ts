import type { Signal} from '@angular/core';
import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiError } from '../http/api-error.mapper';
import { FRONTEND_AUTH_ADAPTER } from './frontend-auth-adapter.token';
import {
  loadingFrontendAuthSnapshot,
  type FrontendAuthSnapshot,
  type ProtectedApiAccessState,
} from './models/frontend-auth.model';

@Injectable({ providedIn: 'root' })
export class FrontendAuthSessionService {
  private readonly adapter = inject(FRONTEND_AUTH_ADAPTER);
  private readonly snapshotState = signal<FrontendAuthSnapshot>(loadingFrontendAuthSnapshot);
  private readonly protectedApiState = signal<ProtectedApiAccessState>('ready');
  private bootstrapPromise: Promise<void> | null = null;

  readonly snapshot: Signal<FrontendAuthSnapshot> = this.snapshotState.asReadonly();
  readonly accessState = this.protectedApiState.asReadonly();
  readonly canAccessProtectedRoutes = computed(() => this.snapshot().state === 'authenticated');

  async bootstrap(): Promise<void> {
    this.bootstrapPromise ??= this.initialize();
    return this.bootstrapPromise;
  }

  async openSignIn(): Promise<void> {
    await this.bootstrap();
    await this.adapter.openSignIn();
  }

  async signOut(): Promise<void> {
    await this.bootstrap();
    await this.adapter.signOut();
  }

  handleProtectedApiError(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;

    if (error.status === 401) {
      this.protectedApiState.set('unauthenticated');
      this.snapshotState.update((current) => ({
        ...current,
        state: 'unauthenticated',
        headers: null,
        reason: error.message,
      }));
      return true;
    }

    if (error.status === 403) {
      this.protectedApiState.set('unauthorized');
      return true;
    }

    return false;
  }

  markProtectedApiReady(): void {
    this.protectedApiState.set('ready');
  }

  private async initialize(): Promise<void> {
    this.adapter.subscribe((snapshot) => {
      this.snapshotState.set(snapshot);
      if (snapshot.state === 'authenticated') {
        this.protectedApiState.set('ready');
      }
    });

    await this.adapter.initialize();
  }
}
