import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'projects',
  },
  {
    path: 'projects',
    loadComponent: () =>
      import('./features/projects/pages/projects-page.component').then(
        (m) => m.ProjectsPageComponent,
      ),
  },
  {
    path: '**',
    redirectTo: 'projects',
  },
];
