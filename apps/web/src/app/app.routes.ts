import type { Routes } from '@angular/router';
import { authGuard } from './shared/auth/auth.guard';

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
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/workspace-shell/workspace-shell.component').then((m) => m.WorkspaceShellComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
