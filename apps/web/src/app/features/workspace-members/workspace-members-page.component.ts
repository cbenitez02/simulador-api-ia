import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideUsers } from '@lucide/angular';
import { SelectMenuComponent, type SelectMenuOption } from '../../shared/ui/select-menu/select-menu.component';

import type { WorkspaceRoleDto } from '../../shared/http/api.types';
import type { WorkspaceMember } from './models/workspace-member.model';

export interface WorkspacePageWorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRoleDto;
  isPersonal?: boolean;
  capabilities: {
    canEdit: boolean;
    canManageMembers: boolean;
  };
}

@Component({
  selector: 'app-workspace-members-page',
  standalone: true,
  imports: [FormsModule, LucideUsers, SelectMenuComponent],
  templateUrl: './workspace-members-page.component.html',
  styleUrls: ['./workspace-members-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceMembersPageComponent {
  readonly workspace = input<WorkspacePageWorkspaceSummary | null>(null);
  readonly currentUserId = input<string | null>(null);
  readonly currentUserEmail = input<string | null>(null);
  readonly members = input<WorkspaceMember[]>([]);
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly mutationPending = input(false);

  readonly addMember = output<{ email: string; role: WorkspaceRoleDto }>();
  readonly removeMember = output<string>();

  protected readonly roleOptions: readonly SelectMenuOption[] = [
    { value: 'viewer', label: 'Viewer' },
    { value: 'editor', label: 'Editor' },
    { value: 'owner', label: 'Owner' },
  ];
  protected readonly selectedRole = signal<WorkspaceRoleDto>('viewer');

  protected readonly canManageMembers = computed(() => this.workspace()?.capabilities.canManageMembers ?? false);

  protected readonly roleLabel = computed(() => {
    switch (this.workspace()?.role) {
      case 'owner':
        return 'Owner';
      case 'editor':
        return 'Editor';
      case 'viewer':
        return 'Viewer';
      default:
        return '—';
    }
  });

  protected readonly memberCountLabel = computed(() => {
    const count = this.members().length;
    return count === 1 ? '1 member' : `${count} members`;
  });

  private normalizeEmail(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  protected isCurrentUser(member: WorkspaceMember): boolean {
    const currentUserId = this.currentUserId();
    if (currentUserId && currentUserId === member.userId) {
      return true;
    }

    const currentUserEmail = this.normalizeEmail(this.currentUserEmail());
    const memberEmail = this.normalizeEmail(member.email);
    return !!currentUserEmail && currentUserEmail === memberEmail;
  }

  protected canRemoveMember(member: WorkspaceMember): boolean {
    if (!this.canManageMembers() || this.mutationPending()) {
      return false;
    }

    const isOwnerSelfRemoval = this.isCurrentUser(member) && member.role === 'owner';

    return !isOwnerSelfRemoval;
  }

  protected onAddMember(email: string, role: WorkspaceRoleDto): void {
    if (!this.canManageMembers() || this.mutationPending()) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

    const nextRole: WorkspaceRoleDto = role === 'owner' || role === 'editor' ? role : 'viewer';
    this.addMember.emit({ email: normalizedEmail, role: nextRole });
  }

  protected onRoleChange(value: string): void {
    const nextRole: WorkspaceRoleDto = value === 'owner' || value === 'editor' ? value : 'viewer';
    this.selectedRole.set(nextRole);
  }

  protected onRemoveMember(memberUserId: string): void {
    const member = this.members().find((item) => item.userId === memberUserId);
    if (!member || !this.canRemoveMember(member)) return;

    const memberLabel = member.displayName || member.email || member.userId;
    const confirmed = globalThis.confirm(`Remove ${memberLabel} from this workspace?`);
    if (!confirmed) return;

    this.removeMember.emit(memberUserId);
  }
}
