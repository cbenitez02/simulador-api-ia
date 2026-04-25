import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAngularExternalResources, setupAngularVitest } from '../../../../testing/angular-vitest';
import { MainDashboardSidebarComponent } from './main-dashboard-sidebar.component';

setupAngularVitest();

const projectFixture = {
  id: 'project-1',
  name: 'Workspace API',
  mockUrl: 'https://mock.example.com/workspace-api',
  endpointCount: 12,
};

async function renderComponent(options?: {
  showSignOut?: boolean;
  userDisplayName?: string | null;
  userUsername?: string | null;
  userAvatarUrl?: string | null;
}) {
  await resolveAngularExternalResources();
  await TestBed.configureTestingModule({
    imports: [MainDashboardSidebarComponent],
    providers: [provideRouter([])],
  }).compileComponents();

  const fixture = TestBed.createComponent(MainDashboardSidebarComponent);
  const component = fixture.componentInstance as unknown as {
    projects: () => (typeof projectFixture)[];
    selectedProjectId: () => string;
    activeNav: () => 'dashboard' | 'logs' | 'endpoints' | 'history' | 'workspace';
    showSignOut: () => boolean;
    userDisplayName: () => string | null;
    userUsername: () => string | null;
    userAvatarUrl: () => string | null;
  };
  component.projects = () => [projectFixture];
  component.selectedProjectId = () => projectFixture.id;
  component.activeNav = () => 'dashboard';
  component.showSignOut = () => options?.showSignOut ?? true;
  component.userDisplayName = () => options?.userDisplayName ?? null;
  component.userUsername = () => options?.userUsername ?? null;
  component.userAvatarUrl = () => options?.userAvatarUrl ?? null;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

describe('MainDashboardSidebarComponent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a sign out action in the sidebar footer when requested', async () => {
    const fixture = await renderComponent();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.sidebar__sign-out-btn')?.textContent).toContain('Sign out');
  });

  it('emits signOutRequested when the sidebar sign out button is clicked', async () => {
    const fixture = await renderComponent();
    const component = fixture.componentInstance;
    const emitSpy = vi.fn();
    component.signOutRequested.subscribe(emitSpy);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.sidebar__sign-out-btn')?.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('hides the sign out action when the shell disables it', async () => {
    const fixture = await renderComponent({ showSignOut: false });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.sidebar__sign-out-btn')).toBeNull();
  });

  it('renders a Workspace navigation entry alongside the existing app sections', async () => {
    const fixture = await renderComponent();
    const element = fixture.nativeElement as HTMLElement;
    const navLabels = Array.from(element.querySelectorAll('.sidebar__nav-item span')).map(
      (span) => span.textContent?.trim() ?? '',
    );

    expect(navLabels).toEqual(['Dashboard', 'Endpoints', 'Logs', 'History', 'Workspace']);
  });

  it('binds the Workspace navigation entry to the /workspace route', async () => {
    const fixture = await renderComponent();
    const navButtons = fixture.debugElement.queryAll(By.directive(RouterLink));
    const workspaceButton = navButtons.find((btn) => btn.nativeElement.textContent?.trim().includes('Workspace'));
    const workspaceLink = workspaceButton?.injector.get(RouterLink);

    expect(workspaceLink?.urlTree?.toString()).toBe('/workspace');
  });

  it('renders the signed-in user block with avatar and name', async () => {
    const fixture = await renderComponent({
      userDisplayName: 'Owner User',
      userUsername: 'owner.user',
      userAvatarUrl: 'https://cdn.example.com/avatar.png',
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.sidebar__user-name')?.textContent).toContain('Owner User');
    expect(element.querySelector('.sidebar__user-username')?.textContent).toContain('@owner.user');
    expect(element.querySelector('.sidebar__user-avatar')?.getAttribute('src')).toBe(
      'https://cdn.example.com/avatar.png',
    );
  });

  it('renders fallback initials when the user has no avatar URL', async () => {
    const fixture = await renderComponent({
      userDisplayName: 'Owner User',
      userAvatarUrl: null,
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.sidebar__user-avatar--fallback')?.textContent?.trim()).toBe('OU');
  });
});
