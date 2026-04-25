import type { CanMatchFn, Routes } from '@angular/router';
import { authGuard } from './shared/auth/auth.guard';
import type { WorkspaceNavId } from './features/workspace-shell/models/workspace-shell.model';

const WORKSPACE_NAV_ROUTES: readonly WorkspaceNavId[] = ['dashboard', 'endpoints', 'logs', 'history', 'workspace'];

const workspaceNavCanMatch: CanMatchFn = (_route, segments) => {
  const navId = segments[0]?.path;
  return typeof navId === 'string' && WORKSPACE_NAV_ROUTES.includes(navId as WorkspaceNavId);
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/auth-session-page.component').then((m) => m.AuthSessionPageComponent),
  },
  {
    path: ':navId',
    canMatch: [workspaceNavCanMatch],
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/workspace-shell/workspace-shell.component').then((m) => m.WorkspaceShellComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
