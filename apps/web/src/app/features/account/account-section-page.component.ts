import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideCopy, LucideFileText, LucideHistory, LucidePencilLine, LucideUsers } from '@lucide/angular';

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
  readonly section = input.required<AccountSectionNavId>();

  protected readonly profile = {
    fullName: 'Alex Chen',
    email: 'alex.chen@company.com',
    company: 'TechCorp Inc',
  };

  protected readonly accountFields: readonly AccountField[] = [
    { icon: 'copy', label: 'Email', value: 'alex.chen@company.com' },
    { icon: 'users', label: 'Role', value: 'Admin' },
    { icon: 'history', label: 'Joined', value: 'January 14, 2023' },
    { icon: 'file', label: 'Last login', value: 'Apr 25, 2026 at 07:38 PM' },
  ];

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
