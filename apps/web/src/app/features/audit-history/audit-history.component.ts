import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { AuditHistoryRepository } from './data-access/audit-history.repository';
import type {
  AuditAction,
  AuditHistoryCursor,
  AuditHistoryEntry,
  AuditHistoryListResult,
} from './models/audit-history.model';

const AUDIT_HISTORY_PAGE_SIZE = 25;

function compareEntries(left: AuditHistoryEntry, right: AuditHistoryEntry): number {
  const timeDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  if (timeDelta !== 0) return timeDelta;
  return right.id.localeCompare(left.id);
}

function mergeEntries(current: AuditHistoryEntry[], incoming: AuditHistoryEntry[]): AuditHistoryEntry[] {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()].sort(compareEntries);
}

function hasOlderHistory(response: AuditHistoryListResult): boolean {
  return response.nextCursor !== null && response.items.length >= AUDIT_HISTORY_PAGE_SIZE;
}

type AuditActionFilter = 'all' | AuditAction;

interface AuditTimelineGroup {
  key: string;
  label: string;
  items: AuditHistoryEntry[];
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function buildGroupLabel(createdAt: string, now = new Date()): string {
  const eventDate = new Date(createdAt);
  const dayDelta = Math.floor((startOfLocalDay(now) - startOfLocalDay(eventDate)) / 86400000);
  if (dayDelta === 0) return 'Today';
  if (dayDelta === 1) return 'Yesterday';
  return eventDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

@Component({
  selector: 'app-audit-history',
  standalone: true,
  templateUrl: './audit-history.component.html',
  styleUrls: ['./audit-history.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditHistoryComponent {
  private readonly repository = inject(AuditHistoryRepository);
  private activeProjectId: string | null = null;

  readonly projectId = input('');
  readonly canRestoreSnapshots = input(false);
  readonly restoreSnapshotRequested = output<string>();

  protected readonly entries = signal<AuditHistoryEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingOlder = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly olderHistoryAvailable = signal(false);
  protected readonly activeFilter = signal<AuditActionFilter>('all');
  private readonly olderCursor = signal<AuditHistoryCursor | null>(null);
  protected readonly actionFilters = computed<AuditActionFilter[]>(() => {
    const usedActions = new Set(this.entries().map((entry) => entry.action));
    const preferredOrder: AuditAction[] = [
      'created',
      'updated',
      'deleted',
      'restored',
      'analyzed',
      'exported',
      'imported',
    ];
    const ordered = preferredOrder.filter((action) => usedActions.has(action));
    return ['all', ...ordered];
  });
  protected readonly filteredEntries = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.entries();
    return this.entries().filter((entry) => entry.action === filter);
  });
  protected readonly groupedEntries = computed<AuditTimelineGroup[]>(() => {
    const groups = new Map<string, AuditTimelineGroup>();
    for (const entry of this.filteredEntries()) {
      const groupLabel = buildGroupLabel(entry.createdAt);
      const key = `${groupLabel}|${entry.createdAt.slice(0, 10)}`;
      const group = groups.get(key);
      if (group) {
        group.items.push(entry);
      } else {
        groups.set(key, { key, label: groupLabel, items: [entry] });
      }
    }
    return [...groups.values()];
  });

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (!projectId || projectId === this.activeProjectId) return;
      this.activeProjectId = projectId;
      void untracked(async () => this.loadProject(projectId));
    });
  }

  protected readonly emptyStateMessage = () => 'No audit history yet for this project.';
  protected readonly filterLabel = (filter: AuditActionFilter): string =>
    filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1);

  protected isFilterActive(filter: AuditActionFilter): boolean {
    return this.activeFilter() === filter;
  }

  protected setFilter(filter: AuditActionFilter): void {
    this.activeFilter.set(filter);
  }

  protected canRestoreEntry(entry: AuditHistoryEntry): boolean {
    return this.canRestoreSnapshots() && entry.resourceType === 'snapshot';
  }

  protected requestRestore(entry: AuditHistoryEntry): void {
    if (!this.canRestoreEntry(entry)) return;
    this.restoreSnapshotRequested.emit(entry.resourceId);
  }

  async loadProject(projectId: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.activeFilter.set('all');
    this.entries.set([]);
    this.olderCursor.set(null);
    this.olderHistoryAvailable.set(false);

    try {
      const response = await this.repository.listEvents(projectId, { limit: AUDIT_HISTORY_PAGE_SIZE });
      this.entries.set(response.items);
      this.olderCursor.set(response.nextCursor);
      this.olderHistoryAvailable.set(hasOlderHistory(response));
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Could not load audit history.');
    } finally {
      this.loading.set(false);
    }
  }

  protected loadOlder(): void {
    void this.loadOlderHistory();
  }

  private async loadOlderHistory(): Promise<void> {
    const projectId = this.projectId();
    const cursor = this.olderCursor();
    if (!projectId || !cursor || this.loadingOlder()) return;

    this.loadingOlder.set(true);
    this.errorMessage.set(null);

    try {
      const response = await this.repository.listEvents(projectId, {
        limit: AUDIT_HISTORY_PAGE_SIZE,
        direction: 'older',
        cursorCreatedAt: cursor.createdAt,
        cursorId: cursor.id,
      });
      this.entries.update((current) => mergeEntries(current, response.items));
      this.olderCursor.set(response.nextCursor);
      this.olderHistoryAvailable.set(hasOlderHistory(response));
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Could not load audit history.');
    } finally {
      this.loadingOlder.set(false);
    }
  }
}
