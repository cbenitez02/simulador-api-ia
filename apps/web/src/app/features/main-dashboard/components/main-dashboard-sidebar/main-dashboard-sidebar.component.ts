import { ChangeDetectionStrategy, Component, computed, input, output, signal, type OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRightLeft,
  LucideCheck,
  LucideCopy,
  LucideFileText,
  LucideHandMetal,
  LucideHistory,
  LucideLayoutGrid,
  LucideLogOut,
  LucidePlus,
  LucideSettings,
  LucideUsers,
} from '@lucide/angular';

import type {
  SidebarProjectPaginationState,
  SidebarProjectRow,
  WorkspaceNavId,
} from '../../../workspace-shell/models/workspace-shell.model';

const ACCOUNT_NAV_ROUTES = new Set<WorkspaceNavId>([
  'account-profile-settings',
  'account-usage',
  'account-plan-billing',
]);

@Component({
  selector: 'app-main-dashboard-sidebar',
  templateUrl: './main-dashboard-sidebar.component.html',
  styleUrls: ['./main-dashboard-sidebar.component.css'],
  standalone: true,
  imports: [
    RouterLink,
    LucideArrowLeft,
    LucideArrowRightLeft,
    LucideCheck,
    LucideHandMetal,
    LucideHistory,
    LucideCopy,
    LucideFileText,
    LucideLayoutGrid,
    LucideLogOut,
    LucidePlus,
    LucideSettings,
    LucideUsers,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainDashboardSidebarComponent implements OnDestroy {
  readonly projects = input.required<SidebarProjectRow[]>();
  readonly selectedProjectId = input.required<string>();
  readonly activeNav = input.required<WorkspaceNavId>();
  readonly showSignOut = input(false);
  readonly userDisplayName = input<string | null>(null);
  readonly userUsername = input<string | null>(null);
  readonly userAvatarUrl = input<string | null>(null);
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly pagination = input<SidebarProjectPaginationState>({
    loaded: 0,
    total: 0,
    hasMore: false,
    loadingMore: false,
    errorMessage: null,
  });

  readonly projectSelect = output<string>();
  readonly createProjectRequested = output<void>();
  readonly retryRequested = output<void>();
  readonly loadMoreRequested = output<void>();
  readonly signOutRequested = output<void>();
  protected readonly copiedMockUrl = signal(false);
  private copyFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
  protected readonly isAccountNav = computed(() => ACCOUNT_NAV_ROUTES.has(this.activeNav()));

  protected readonly activeProject = computed((): SidebarProjectRow | null => {
    const list = this.projects();
    if (!list.length) return null;
    const id = this.selectedProjectId();
    return list.find((p) => p.id === id) ?? list[0] ?? null;
  });

  protected readonly displayMockUrl = computed(() => {
    const ap = this.activeProject();
    if (!ap) return '';
    const url = ap.mockUrl;
    const max = 20;
    return url.length <= max ? url : `${url.slice(0, max)}...`;
  });

  protected readonly normalizedUserDisplayName = computed(() => {
    const displayName = this.userDisplayName();
    if (!displayName) return null;
    const trimmed = displayName.trim();
    return trimmed.length ? trimmed : null;
  });

  protected readonly normalizedUserAvatarUrl = computed(() => {
    const avatarUrl = this.userAvatarUrl();
    if (!avatarUrl) return null;
    const trimmed = avatarUrl.trim();
    return trimmed.length ? trimmed : null;
  });

  protected readonly userHandle = computed(() => {
    const username = this.userUsername();
    if (!username) return null;
    const trimmed = username.trim();
    if (!trimmed.length) return null;
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  });

  protected readonly userInitials = computed(() => {
    const displayName = this.normalizedUserDisplayName();
    if (!displayName) return '?';
    const words = displayName.split(/\s+/).filter(Boolean);
    if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase();
    return words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  });

  protected selectProject(id: string): void {
    this.projectSelect.emit(id);
  }

  protected addProject(): void {
    this.createProjectRequested.emit();
  }

  protected retry(): void {
    this.retryRequested.emit();
  }

  protected loadMore(): void {
    this.loadMoreRequested.emit();
  }

  protected async copyMockUrl(): Promise<void> {
    const ap = this.activeProject();
    if (!ap) return;
    try {
      await navigator.clipboard.writeText(ap.mockUrl);
      this.copiedMockUrl.set(true);
      if (this.copyFeedbackTimeoutId) {
        clearTimeout(this.copyFeedbackTimeoutId);
      }
      this.copyFeedbackTimeoutId = setTimeout(() => {
        this.copiedMockUrl.set(false);
        this.copyFeedbackTimeoutId = null;
      }, 1500);
    } catch {
      this.copiedMockUrl.set(false);
    }
  }

  protected signOut(): void {
    this.signOutRequested.emit();
  }

  ngOnDestroy(): void {
    if (this.copyFeedbackTimeoutId) {
      clearTimeout(this.copyFeedbackTimeoutId);
      this.copyFeedbackTimeoutId = null;
    }
  }
}
