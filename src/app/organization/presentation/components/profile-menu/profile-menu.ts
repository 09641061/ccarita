import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Avatar } from '../../../../shared/presentation/components/avatar/avatar';
import { SettingsLink } from '../../../../shared/presentation/navigation/settings-link';
import { PlanKind } from '../../../domain/model/organization';

/**
 * The profile button at the foot of the drawer, Claude-like: the user's name and, after a dot, the organization's
 * plan. Its menu opens the settings center, another organization or the Takodu team's area when they apply, and
 * signs out; "Ayuda", "Subir plan" and "Aprender más" are placeholders until Takodu has them. Lines separate who
 * you are, where to go, Takodu's offer and signing out. `compact` shows only
 * the avatar, for the phone's top bar, with the name and email in the menu.
 */
@Component({
  selector: 'app-profile-menu',
  imports: [
    Avatar,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    RouterLink,
    SettingsLink,
    TranslatePipe,
  ],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.scss',
  host: { '[class.compact]': 'compact()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileMenu {
  /** The user's own name, or the email when they gave none. */
  readonly name = input.required<string>();
  readonly email = input.required<string>();
  /** The organization's plan; `null` while unknown. */
  readonly plan = input<PlanKind | null>(null);
  /** The user belongs to several organizations. */
  readonly canSwitch = input(false);
  /** The user is on the Takodu team (`PLATFORM_ENTRY`). */
  readonly platform = input(false);
  readonly compact = input(false);
  readonly signOut = output<void>();
}
