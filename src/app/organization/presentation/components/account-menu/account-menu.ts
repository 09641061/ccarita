import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { MemberRole } from '../../../domain/model/member-role';

/**
 * Who is signed in, with which role in which organization, and the menu to the account, another organization or
 * signing out. `compact` shows only the avatar, for the phone's top bar.
 */
@Component({
  selector: 'app-account-menu',
  imports: [Avatar, MatIconModule, MatMenuModule, RouterLink, TranslatePipe],
  templateUrl: './account-menu.html',
  styleUrl: './account-menu.scss',
  host: { '[class.compact]': 'compact()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountMenu {
  readonly name = input.required<string>();
  readonly role = input.required<MemberRole>();
  readonly organizationName = input.required<string>();
  /** The user belongs to several organizations. */
  readonly canSwitch = input(false);
  readonly compact = input(false);
  readonly signOut = output<void>();
}
