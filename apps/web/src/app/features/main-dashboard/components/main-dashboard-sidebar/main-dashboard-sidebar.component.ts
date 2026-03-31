import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  LucideArrowRightLeft,
  LucideCopy,
  LucideFileText,
  LucideLayoutGrid,
  LucideLeaf,
  LucidePlus,
  LucideSettings,
} from '@lucide/angular';

import type { SidebarProjectRow, WorkspaceNavId } from '../../../workspace-shell/models/workspace-shell.model';

@Component({
  selector: 'app-main-dashboard-sidebar',
  templateUrl: './main-dashboard-sidebar.component.html',
  styleUrls: ['./main-dashboard-sidebar.component.css'],
  standalone: true,
  imports: [LucideArrowRightLeft, LucideCopy, LucideFileText, LucideLayoutGrid, LucideLeaf, LucidePlus, LucideSettings],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDashboardSidebarComponent {
  readonly projects = input.required<SidebarProjectRow[]>();
  readonly selectedProjectId = input.required<string>();
  readonly activeNav = input.required<WorkspaceNavId>();

  readonly projectSelect = output<string>();
  readonly navSelect = output<WorkspaceNavId>();

  protected readonly activeProject = computed(() => {
    const id = this.selectedProjectId();
    return this.projects().find((p) => p.id === id) ?? this.projects()[0];
  });

  protected readonly displayMockUrl = computed(() => {
    const url = this.activeProject().mockUrl;
    const max = 20;
    return url.length <= max ? url : `${url.slice(0, max)}...`;
  });

  protected selectProject(id: string): void {
    this.projectSelect.emit(id);
  }

  protected selectNav(id: WorkspaceNavId): void {
    this.navSelect.emit(id);
  }

  protected addProject(): void {
    // Placeholder until project creation exists
  }

  protected copyMockUrl(): void {
    const url = this.activeProject().mockUrl;
    void navigator.clipboard.writeText(url);
  }
}
