import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/workspace-shell/workspace-shell.component').then((m) => m.WorkspaceShellComponent),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
