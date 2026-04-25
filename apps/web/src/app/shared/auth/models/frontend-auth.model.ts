export type FrontendAuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'misconfigured' | 'error';

export interface FrontendSessionHeaders {
  authStatus: 'signed-in';
  userId: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
}

export interface FrontendAuthSnapshot {
  state: FrontendAuthState;
  userId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  headers: FrontendSessionHeaders | null;
  reason: string | null;
}

export type ProtectedApiAccessState = 'ready' | 'unauthenticated' | 'unauthorized';

export const loadingFrontendAuthSnapshot: FrontendAuthSnapshot = {
  state: 'loading',
  userId: null,
  displayName: null,
  avatarUrl: null,
  email: null,
  emailVerified: false,
  headers: null,
  reason: null,
};
