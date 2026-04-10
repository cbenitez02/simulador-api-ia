import type { FrontendAuthSnapshot } from '../models/frontend-auth.model';

export interface FrontendAuthAdapter {
  initialize(): Promise<void>;
  getSnapshot(): FrontendAuthSnapshot;
  subscribe(listener: (snapshot: FrontendAuthSnapshot) => void): () => void;
  openSignIn(): Promise<void>;
  signOut(): Promise<void>;
}
