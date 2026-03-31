import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ProjectItem {
  id: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
  readonly projects = signal<ProjectItem[]>([
    {
      id: '1',
      name: 'E-commerce demo',
      description: 'Mocks para catálogo, carrito y checkout',
    },
    {
      id: '2',
      name: 'Admin dashboard',
      description: 'Mocks para usuarios, métricas y auditoría',
    },
  ]);
}
