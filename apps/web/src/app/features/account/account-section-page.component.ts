import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LucideCopy, LucideFileText, LucideHistory, LucidePencilLine, LucideUsers } from '@lucide/angular';

import { FrontendAuthSessionService } from '../../shared/auth/frontend-auth-session.service';

type AccountSectionNavId =
  | 'account-profile-settings'
  | 'account-api-keys'
  | 'account-notifications'
  | 'account-security'
  | 'account-usage'
  | 'account-plan-billing';

interface AccountField {
  icon: 'copy' | 'history' | 'file' | 'users';
  label: string;
  value: string;
}

@Component({
  selector: 'app-account-section-page',
  standalone: true,
  imports: [LucideCopy, LucideFileText, LucideHistory, LucidePencilLine, LucideUsers],
  templateUrl: './account-section-page.component.html',
  styleUrls: ['./account-section-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSectionPageComponent {
  private readonly authSession = inject(FrontendAuthSessionService);

  readonly section = input.required<AccountSectionNavId>();

  /** Mock: sustituir por dato real cuando exista API de billing (`Free` | `Pro`). */
  protected readonly accountPlanMock: 'Free' | 'Pro' = 'Free';

  /** Perfil desde la sesión Clerk (misma fuente que el sidebar y las llamadas API). */
  protected readonly profileDisplay = computed(() => {
    const s = this.authSession.snapshot();
    const email = s.email?.trim() || null;
    const displayName = s.displayName?.trim() || null;
    const primaryLabel = displayName || email;
    const rawUser = s.username?.trim();
    const handle = rawUser != null && rawUser.length > 0 ? (rawUser.startsWith('@') ? rawUser : `@${rawUser}`) : null;
    const avatarUrl = s.avatarUrl?.trim() || null;

    return {
      fullName: primaryLabel ?? '—',
      email: email ?? '—',
      handle,
      avatarUrl,
      initials: initialsFromName(primaryLabel ?? email ?? '?'),
    };
  });

  protected readonly accountInfoFields = computed((): AccountField[] => {
    const s = this.authSession.snapshot();
    const email = s.email?.trim() || '—';
    const raw = s.username?.trim();
    const username = raw != null && raw.length > 0 ? (raw.startsWith('@') ? raw : `@${raw}`) : '—';
    const verified = s.emailVerified ? 'Yes' : 'No';

    return [
      { icon: 'copy', label: 'Email', value: email },
      { icon: 'users', label: 'Username', value: username },
      { icon: 'history', label: 'Email verified', value: verified },
      { icon: 'file', label: 'Account plan', value: this.accountPlanMock },
    ];
  });

  protected readonly billingHighlights: readonly string[] = ['5 endpoints', '1000 requests/month', 'No AI generation'];

  protected readonly usageHighlights: readonly string[] = [
    '2,340 requests this month',
    '8 endpoints created',
    '12 AI generations',
  ];

  protected readonly title = computed(() => {
    switch (this.section()) {
      case 'account-profile-settings':
        return 'Profile Settings';
      case 'account-api-keys':
        return 'API Keys';
      case 'account-notifications':
        return 'Notifications';
      case 'account-security':
        return 'Security';
      case 'account-usage':
        return 'Usage';
      case 'account-plan-billing':
        return 'Plan / Billing';
    }
  });
}

function initialsFromName(displayName: string): string {
  const words = displayName.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const w = words[0] ?? '';
    return w.slice(0, 2).toUpperCase();
  }
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
