import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SessionStore } from '../../../../iam/public-api';
import { Wordmark } from '../../../../shared/presentation/components/wordmark/wordmark';

/**
 * The Takodu team's frame: no establishment, role navigation or plan, since an operator works across organizations
 * and may belong to none. A link back to their own businesses and signing out; a session pibble refuses returns
 * to sign-in, as in the workspace.
 */
@Component({
  selector: 'app-platform-frame',
  imports: [Wordmark, MatButtonModule, MatIconModule, RouterLink, RouterOutlet, TranslatePipe],
  template: `
    <header class="bar">
      <a class="brand" routerLink="/platform">
        <app-wordmark class="wordmark" />
        <span class="tag">{{ 'platform.frame.team' | translate }}</span>
      </a>
      @if (session.user(); as user) {
        <span class="who">{{ user.email }}</span>
      }
      <a
        matIconButton
        routerLink="/organizaciones"
        [attr.aria-label]="'platform.frame.myBusinesses' | translate"
      >
        <mat-icon aria-hidden="true">storefront</mat-icon>
      </a>
      <button
        matIconButton
        type="button"
        [attr.aria-label]="'platform.frame.signOut' | translate"
        (click)="signOut()"
      >
        <mat-icon aria-hidden="true">logout</mat-icon>
      </button>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  styleUrl: './platform-frame.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformFrame {
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);

  constructor() {
    effect(() => {
      if (this.session.isSignedIn()) return;
      untracked(() => {
        const volver = this.session.signedOut() ? undefined : this.router.url;
        void this.router.navigate(['/ingresar'], { queryParams: { volver } });
      });
    });
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
  }
}
