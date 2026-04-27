import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { resolveAngularExternalResources, setupAngularVitest } from '../../testing/angular-vitest';
import type { WorkspaceInvitationDto } from '../../shared/http/api.types';
import type { WorkspaceMember } from './models/workspace-member.model';
import { WorkspaceMembersPageComponent, type WorkspacePageWorkspaceSummary } from './workspace-members-page.component';

setupAngularVitest();

const ownerWorkspace: WorkspacePageWorkspaceSummary = {
  id: 'workspace-1',
  name: 'Workspace project',
  role: 'owner',
  isPersonal: false,
  capabilities: { canEdit: true, canManageMembers: true },
};

const personalOwnerWorkspace: WorkspacePageWorkspaceSummary = {
  ...ownerWorkspace,
  id: 'workspace-personal-1',
  name: 'Personal workspace',
  isPersonal: true,
};

const membersFixture: WorkspaceMember[] = [
  {
    userId: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner User',
    role: 'owner',
    createdAt: '2026-04-08T10:00:00.000Z',
  },
  {
    userId: 'user-2',
    email: 'editor@example.com',
    displayName: 'Editor User',
    role: 'editor',
    createdAt: '2026-04-08T10:05:00.000Z',
  },
];

const pendingInvitationsFixture: WorkspaceInvitationDto[] = [
  {
    id: 'invite-1',
    workspaceId: 'workspace-1',
    workspaceName: 'Workspace project',
    email: 'newcomer@example.com',
    role: 'editor',
    status: 'pending',
    createdAt: '2026-04-08T10:10:00.000Z',
  },
];

async function renderPage(
  overrides: {
    workspace?: WorkspacePageWorkspaceSummary | null;
    currentUserId?: string | null;
    currentUserEmail?: string | null;
    members?: WorkspaceMember[];
    invitations?: WorkspaceInvitationDto[];
    loading?: boolean;
    errorMessage?: string | null;
    mutationPending?: boolean;
  } = {},
) {
  await resolveAngularExternalResources();
  await TestBed.configureTestingModule({
    imports: [WorkspaceMembersPageComponent],
  }).compileComponents();

  const fixture = TestBed.createComponent(WorkspaceMembersPageComponent);
  const component = fixture.componentInstance as unknown as {
    workspace: () => WorkspacePageWorkspaceSummary | null;
    currentUserId: () => string | null;
    currentUserEmail: () => string | null;
    members: () => WorkspaceMember[];
    invitations: () => WorkspaceInvitationDto[];
    loading: () => boolean;
    errorMessage: () => string | null;
    mutationPending: () => boolean;
  };

  component.workspace = () => ('workspace' in overrides ? (overrides.workspace ?? null) : ownerWorkspace);
  component.currentUserId = () => overrides.currentUserId ?? null;
  component.currentUserEmail = () => overrides.currentUserEmail ?? null;
  component.members = () => overrides.members ?? membersFixture;
  component.invitations = () => overrides.invitations ?? pendingInvitationsFixture;
  component.loading = () => overrides.loading ?? false;
  component.errorMessage = () => overrides.errorMessage ?? null;
  component.mutationPending = () => overrides.mutationPending ?? false;

  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('WorkspaceMembersPageComponent', () => {
  it('renders workspace name, role label, and member rows', async () => {
    const fixture = await renderPage();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.workspace-members-page__title')?.textContent).toContain('Workspace');
    expect(element.querySelector('.workspace-members-page__sub')?.textContent).toContain('Workspace project');
    expect(element.querySelector('.workspace-members-page__role-pill')?.textContent).toContain('Owner');

    const rows = Array.from(element.querySelectorAll('.workspace-members-page__row'));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Owner User');
    expect(rows[1]?.textContent).toContain('Editor User');
  });

  it('hides remove button for owner self in personal workspaces and renders owner/self badges', async () => {
    const fixture = await renderPage({
      workspace: personalOwnerWorkspace,
      currentUserId: 'user-1',
    });
    const element = fixture.nativeElement as HTMLElement;
    const rows = Array.from(element.querySelectorAll('.workspace-members-page__row'));

    expect(rows[0]?.textContent).toContain('Owner User');
    expect(rows[0]?.querySelector('.workspace-members-page__remove')).toBeNull();
    expect(rows[0]?.querySelector('.workspace-members-page__badge--owner')?.textContent).toContain('Owner');
    expect(rows[0]?.querySelector('.workspace-members-page__badge--self')?.textContent).toContain('You');
    expect(rows[1]?.querySelector('.workspace-members-page__remove')?.getAttribute('aria-label')).toBe('Remove member');
  });

  it('shows remove button for owner self in non-personal workspaces when no other restriction applies', async () => {
    const fixture = await renderPage({
      workspace: ownerWorkspace,
      currentUserId: 'user-1',
    });
    const element = fixture.nativeElement as HTMLElement;
    const rows = Array.from(element.querySelectorAll('.workspace-members-page__row'));

    expect(rows[0]?.textContent).toContain('Owner User');
    expect(rows[0]?.querySelector('.workspace-members-page__badge--owner')?.textContent).toContain('Owner');
    expect(rows[0]?.querySelector('.workspace-members-page__badge--self')?.textContent).toContain('You');
    expect(rows[0]?.querySelector('.workspace-members-page__remove')?.getAttribute('aria-label')).toBe('Remove member');
  });

  it('detects current user by email when userId differs in personal workspaces', async () => {
    const fixture = await renderPage({
      workspace: personalOwnerWorkspace,
      currentUserId: 'another-id',
      currentUserEmail: 'owner@example.com',
    });
    const element = fixture.nativeElement as HTMLElement;
    const rows = Array.from(element.querySelectorAll('.workspace-members-page__row'));

    expect(rows[0]?.querySelector('.workspace-members-page__badge--self')?.textContent).toContain('You');
    expect(rows[0]?.querySelector('.workspace-members-page__remove')).toBeNull();
  });

  it('emits removeMember when an actionable member row triggers remove', async () => {
    const fixture = await renderPage();
    const component = fixture.componentInstance;
    const emitSpy = vi.fn();
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    component.removeMember.subscribe(emitSpy);

    const button = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.workspace-members-page__remove',
    )[0];
    button?.click();

    expect(confirmSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith('user-1');
    confirmSpy.mockRestore();
  });

  it('does not emit removeMember when remove confirmation is cancelled', async () => {
    const fixture = await renderPage();
    const component = fixture.componentInstance;
    const emitSpy = vi.fn();
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    component.removeMember.subscribe(emitSpy);

    const button = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.workspace-members-page__remove',
    )[0];
    button?.click();

    expect(confirmSpy).toHaveBeenCalled();
    expect(emitSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('emits addMember with normalized payload when the form is submitted', async () => {
    const fixture = await renderPage();
    const component = fixture.componentInstance as WorkspaceMembersPageComponent;
    const emitSpy = vi.fn();
    component.addMember.subscribe(emitSpy);

    const element = fixture.nativeElement as HTMLElement;
    const emailInput = element.querySelector<HTMLInputElement>('.workspace-members-page__input');
    const form = element.querySelector('form');
    const roleTrigger = element.querySelector<HTMLButtonElement>('#workspace-members-role-trigger');

    if (!emailInput || !form || !roleTrigger) {
      throw new Error('Form fields not rendered');
    }

    roleTrigger.click();
    fixture.detectChanges();

    const editorOption = Array.from(
      element.querySelectorAll<HTMLButtonElement>('#workspace-members-role-listbox .select-menu__option'),
    ).find((option) => option.textContent?.includes('Editor'));

    if (!editorOption) {
      throw new Error('Editor role option not rendered');
    }

    editorOption.click();
    fixture.detectChanges();

    emailInput.value = '  newcomer@example.com  ';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    form.dispatchEvent(new Event('submit'));

    expect(emitSpy).toHaveBeenCalledWith({ email: 'newcomer@example.com', role: 'editor' });
    expect(roleTrigger.getAttribute('aria-label')).toContain('Editor');
    expect(element.querySelector('.workspace-members-page__submit')?.textContent).toContain('Send invite');
  });

  it('renders pending invitations and emits revoke for actionable invitations', async () => {
    const fixture = await renderPage({ currentUserId: 'user-1' });
    const component = fixture.componentInstance as WorkspaceMembersPageComponent;
    const emitSpy = vi.fn();
    component.revokeInvitation.subscribe(emitSpy);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Pending invitations');
    expect(element.textContent).toContain('newcomer@example.com');
    expect(element.textContent).toContain('editor');

    const revokeButton = element.querySelector<HTMLButtonElement>('.workspace-members-page__revoke-invite');
    revokeButton?.click();

    expect(emitSpy).toHaveBeenCalledWith('invite-1');
  });

  it('emits updateMemberRole when an owner changes another member role from the row UI', async () => {
    const fixture = await renderPage({ currentUserId: 'user-1' });
    const component = fixture.componentInstance as WorkspaceMembersPageComponent;
    const emitSpy = vi.fn();
    component.updateMemberRole.subscribe(emitSpy);

    const element = fixture.nativeElement as HTMLElement;
    const roleTriggers = Array.from(
      element.querySelectorAll<HTMLButtonElement>('[id^="workspace-member-role-trigger-"]'),
    );
    const editorRowTrigger = roleTriggers.find((trigger) => trigger.id.endsWith('user-2'));

    if (!editorRowTrigger) {
      throw new Error('Member role trigger not rendered');
    }

    editorRowTrigger.click();
    fixture.detectChanges();

    const ownerOption = Array.from(
      element.querySelectorAll<HTMLButtonElement>('#workspace-member-role-listbox-user-2 .select-menu__option'),
    ).find((option) => option.textContent?.includes('Owner'));

    if (!ownerOption) {
      throw new Error('Owner role option not rendered');
    }

    ownerOption.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith({ memberUserId: 'user-2', role: 'owner' });
  });

  it('hides self role editing control in the row UI for the current user', async () => {
    const fixture = await renderPage({ currentUserId: 'user-1' });
    const element = fixture.nativeElement as HTMLElement;
    const selfTrigger = element.querySelector<HTMLButtonElement>('#workspace-member-role-trigger-user-1');

    expect(selfTrigger).toBeNull();
  });

  it('shows a placeholder when no workspace is bound yet', async () => {
    const fixture = await renderPage({ workspace: null });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.workspace-members-page--placeholder')).not.toBeNull();
    expect(element.textContent).toContain('Select a project');
  });
});
