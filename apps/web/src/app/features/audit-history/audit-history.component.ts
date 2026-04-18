import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AuditHistoryRepository } from './data-access/audit-history.repository';
import type { AuditHistoryCursor, AuditHistoryEntry } from './models/audit-history.model';

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
  private readonly olderCursor = signal<AuditHistoryCursor | null>(null);

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (!projectId || projectId === this.activeProjectId) return;
      this.activeProjectId = projectId;
      void untracked(async () => this.loadProject(projectId));
    });
  }

  protected readonly emptyStateMessage = () => 'No audit history yet for this project.';

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
    this.entries.set([]);
    this.olderCursor.set(null);
    this.olderHistoryAvailable.set(false);

    try {
      const response = await this.repository.listEvents(projectId, {});
      this.entries.set(response.items);
      this.olderCursor.set(response.nextCursor);
      this.olderHistoryAvailable.set(response.nextCursor !== null && response.items.length > 0);
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
        direction: 'older',
        cursorCreatedAt: cursor.createdAt,
        cursorId: cursor.id,
      });
      this.entries.update((current) => mergeEntries(current, response.items));
      this.olderCursor.set(response.nextCursor);
      this.olderHistoryAvailable.set(response.nextCursor !== null && response.items.length > 0);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Could not load audit history.');
    } finally {
      this.loadingOlder.set(false);
    }
  }
}
