import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LucideCalendar, LucideCopy, LucideFileText, LucideHistory, LucideUsers } from '@lucide/angular';

import { FrontendAuthSessionService } from '../../shared/auth/frontend-auth-session.service';
import { UsageAiSideCardComponent } from './components/usage-ai-side-card/usage-ai-side-card.component';
import { UsageQuotaCardComponent } from './components/usage-quota-card/usage-quota-card.component';
import type { UsageQuotaCardIcon } from './components/usage-quota-card/usage-quota-card.model';
import { UsageEndpointUsageComponent } from './components/usage-endpoint-usage/usage-endpoint-usage.component';
import { UsageRequestsOverTimeComponent } from './components/usage-requests-over-time/usage-requests-over-time.component';

type AccountSectionNavId = 'account-profile-settings' | 'account-usage' | 'account-plan-billing';

interface AccountField {
  icon: 'copy' | 'history' | 'file' | 'users';
  label: string;
  value: string;
}

interface UsageQuotaCard {
  id: string;
  label: string;
  used: number;
  limit: number;
  icon: UsageQuotaCardIcon;
  trend?: { direction: 'up' | 'down'; pct: number };
}

interface UsageQuotaRow extends UsageQuotaCard {
  pct: number;
  /** Verde por defecto; naranja en requests con uso alto (como referencia visual). */
  barFill: 'accent' | 'orange';
  usedFormatted: string;
  limitFormatted: string;
}

const USAGE_QUOTA_CARDS_MOCK: readonly UsageQuotaCard[] = [
  {
    id: 'requests',
    label: 'Requests this month',
    used: 8432,
    limit: 10000,
    icon: 'requests',
    trend: { direction: 'up', pct: 12 },
  },
  {
    id: 'endpoints',
    label: 'Endpoints created',
    used: 12,
    limit: 20,
    icon: 'endpoints',
    trend: { direction: 'up', pct: 5 },
  },
  {
    id: 'ai',
    label: 'AI generations',
    used: 24,
    limit: 50,
    icon: 'ai',
    trend: { direction: 'down', pct: 8 },
  },
  {
    id: 'projects',
    label: 'Projects',
    used: 2,
    limit: 3,
    icon: 'projects',
  },
] as const;

const USAGE_NUMBER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

@Component({
  selector: 'app-account-section-page',
  standalone: true,
  imports: [
    UsageAiSideCardComponent,
    UsageEndpointUsageComponent,
    UsageQuotaCardComponent,
    UsageRequestsOverTimeComponent,
    LucideCalendar,
    LucideCopy,
    LucideFileText,
    LucideHistory,
    LucideUsers,
  ],
  templateUrl: './account-section-page.component.html',
  styleUrls: ['./account-section-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSectionPageComponent {
  private readonly authSession = inject(FrontendAuthSessionService);

  readonly section = input.required<AccountSectionNavId>();

  /** Mock: sustituir por dato real cuando exista API de billing (`Free` | `Pro`). */
  protected readonly accountPlanMock: 'Free' | 'Pro' = 'Free';

  /** Mock: días hasta el reset del período de facturación. */
  protected readonly usageBillingResetDays = 12;

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

  /** Mock enriquecido para la cuadrícula Usage; sustituir por API cuando exista. */
  protected readonly usageQuotaRows = computed((): UsageQuotaRow[] => {
    return USAGE_QUOTA_CARDS_MOCK.map((c) => {
      const pct = c.limit <= 0 ? 0 : Math.min(100, Math.round((c.used / c.limit) * 1000) / 10);
      const barFill: 'accent' | 'orange' = c.id === 'requests' && pct >= 72 ? 'orange' : 'accent';
      return {
        ...c,
        pct,
        barFill,
        usedFormatted: USAGE_NUMBER_FORMAT.format(c.used),
        limitFormatted: USAGE_NUMBER_FORMAT.format(c.limit),
      };
    });
  });

  protected readonly title = computed(() => {
    switch (this.section()) {
      case 'account-profile-settings':
        return 'Profile Settings';
      case 'account-usage':
        return 'Usage';
      case 'account-plan-billing':
        return 'Plan / Billing';
    }
  });

  protected readonly subtitle = computed(() => {
    switch (this.section()) {
      case 'account-usage':
        return 'Monitor your API requests and resource consumption';
      default:
        return 'Manage your account and preferences';
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
