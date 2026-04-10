import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FrontendAuthSessionService } from '../../shared/auth/frontend-auth-session.service';

@Component({
  selector: 'app-auth-session-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './auth-session-page.component.html',
  styleUrl: './auth-session-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthSessionPageComponent {
  private readonly authSession = inject(FrontendAuthSessionService);

  protected readonly snapshot = this.authSession.snapshot;
  protected readonly title = computed(() => {
    switch (this.snapshot().state) {
      case 'authenticated':
        return 'Your secure session is ready';
      case 'misconfigured':
        return 'Frontend auth is not configured';
      case 'error':
        return 'We could not initialize the auth boundary';
      case 'loading':
        return 'Initializing secure session';
      case 'unauthenticated':
      default:
        return 'Sign in to access the workspace';
    }
  });

  protected readonly description = computed(() => {
    switch (this.snapshot().state) {
      case 'authenticated':
        return 'Your Clerk session is active and the Angular app can now call the protected management API.';
      case 'misconfigured':
        return 'Set clerkPublishableKey in apps/web/public/app-config.js or inject it at runtime before serving the app.';
      case 'error':
        return this.snapshot().reason ?? 'The Clerk SDK failed to load.';
      case 'loading':
        return 'We are preparing the frontend auth boundary before entering the protected workspace.';
      case 'unauthenticated':
      default:
        return 'Use Clerk sign-in first so the frontend can attach the protected management-session headers.';
    }
  });

  constructor() {
    void this.authSession.bootstrap();
  }

  protected openSignIn(): void {
    void this.authSession.openSignIn();
  }

  protected signOut(): void {
    void this.authSession.signOut();
  }
}
