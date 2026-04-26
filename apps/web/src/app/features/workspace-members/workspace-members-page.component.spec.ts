import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { resolveAngularExternalResources, setupAngularVitest } from '../../testing/angular-vitest';
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

async function renderPage(
  overrides: {
    workspace?: WorkspacePageWorkspaceSummary | null;
    currentUserId?: string | null;
    currentUserEmail?: string | null;
    members?: WorkspaceMember[];
    loading?: boolean;
    errorMessage?: string | null;
    mutationPending?: boolean;
  } = {},
) {
  await resolveAngularExternalResources();
  await TestBed.configureTestingModule({
    imports: [WorkspaceMembersPageComponent],
    schemas: [NO_ERRORS_SCHEMA],
  }).compileComponents();

  const fixture = TestBed.createComponent(WorkspaceMembersPageComponent);
  const component = fixture.componentInstance as unknown as {
    workspace: () => WorkspacePageWorkspaceSummary | null;
    currentUserId: () => string | null;
    currentUserEmail: () => string | null;
    members: () => WorkspaceMember[];
    loading: () => boolean;
    errorMessage: () => string | null;
    mutationPending: () => boolean;
  };

  component.workspace = () => ('workspace' in overrides ? (overrides.workspace ?? null) : ownerWorkspace);
  component.currentUserId = () => overrides.currentUserId ?? null;
  component.currentUserEmail = () => overrides.currentUserEmail ?? null;
  component.members = () => overrides.members ?? membersFixture;
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

  it('hides remove button for owner self and renders owner/self badges', async () => {
    const fixture = await renderPage({
      workspace: ownerWorkspace,
      currentUserId: 'user-1',
    });
    const element = fixture.nativeElement as HTMLElement;
    const rows = Array.from(element.querySelectorAll('.workspace-members-page__row'));

    expect(rows[0]?.textContent).toContain('Owner User');
    expect(rows[0]?.querySelector('.workspace-members-page__remove')).toBeNull();
    expect(rows[0]?.querySelector('.workspace-members-page__badge--owner')?.textContent).toContain('Owner');
    expect(rows[0]?.querySelector('.workspace-members-page__badge--self')?.textContent).toContain('You');
    expect(rows[1]?.querySelector('.workspace-members-page__remove')?.textContent).toContain('Remove');
  });

  it('detects current user by email when userId differs', async () => {
    const fixture = await renderPage({
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
    const component = fixture.componentInstance as WorkspaceMembersPageComponent & {
      selectedRole: { set(value: 'viewer' | 'editor' | 'owner'): void };
    };
    const emitSpy = vi.fn();
    component.addMember.subscribe(emitSpy);
    component.selectedRole.set('editor');

    const element = fixture.nativeElement as HTMLElement;
    const emailInput = element.querySelector<HTMLInputElement>('.workspace-members-page__input');
    const form = element.querySelector('form');

    if (!emailInput || !form) {
      throw new Error('Form fields not rendered');
    }

    emailInput.value = '  newcomer@example.com  ';
    form.dispatchEvent(new Event('submit'));

    expect(emitSpy).toHaveBeenCalledWith({ email: 'newcomer@example.com', role: 'editor' });
  });

  it('shows a placeholder when no workspace is bound yet', async () => {
    const fixture = await renderPage({ workspace: null });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.workspace-members-page--placeholder')).not.toBeNull();
    expect(element.textContent).toContain('Select a project');
  });
});
