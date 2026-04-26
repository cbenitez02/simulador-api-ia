import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideCopy, LucideFileText, LucideHistory, LucidePencilLine, LucideUsers } from '@lucide/angular';

interface AccountField {
  icon: 'copy' | 'history' | 'file' | 'users';
  label: string;
  value: string;
}

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [LucideCopy, LucideFileText, LucideHistory, LucidePencilLine, LucideUsers],
  templateUrl: './account-page.component.html',
  styleUrls: ['./account-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPageComponent {
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
}
