import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  LucideArrowRightLeft,
  LucideCopy,
  LucideFileText,
  LucideHandMetal,
  LucideLayoutGrid,
  LucidePlus,
  LucideSettings,
} from '@lucide/angular';

import type { SidebarProjectRow, WorkspaceNavId } from '../../../workspace-shell/models/workspace-shell.model';

@Component({
  selector: 'app-main-dashboard-sidebar',
  templateUrl: './main-dashboard-sidebar.component.html',
  styleUrls: ['./main-dashboard-sidebar.component.css'],
  standalone: true,
  imports: [
    LucideArrowRightLeft,
    LucideHandMetal,
    LucideCopy,
    LucideFileText,
    LucideLayoutGrid,
    LucidePlus,
    LucideSettings,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDashboardSidebarComponent {
  readonly projects = input.required<SidebarProjectRow[]>();
  readonly selectedProjectId = input.required<string>();
  readonly activeNav = input.required<WorkspaceNavId>();

  readonly projectSelect = output<string>();
  readonly navSelect = output<WorkspaceNavId>();
  readonly createProjectRequested = output<void>();

  protected readonly activeProject = computed((): SidebarProjectRow | null => {
    const list = this.projects();
    if (!list.length) return null;
    const id = this.selectedProjectId();
    return list.find((p) => p.id === id) ?? list[0]!;
  });

  protected readonly displayMockUrl = computed(() => {
    const ap = this.activeProject();
    if (!ap) return '';
    const url = ap.mockUrl;
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
    this.createProjectRequested.emit();
  }

  protected copyMockUrl(): void {
    const ap = this.activeProject();
    if (!ap) return;
    void navigator.clipboard.writeText(ap.mockUrl);
  }
}
