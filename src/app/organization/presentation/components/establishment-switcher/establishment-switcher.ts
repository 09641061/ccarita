import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { Establishment } from '../../../domain/model/establishment';

/**
 * The establishment the user works in, and a menu to change it when they see more than one (O13). `compact` is the
 * phone's top bar version.
 */
@Component({
  selector: 'app-establishment-switcher',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, TranslatePipe],
  templateUrl: './establishment-switcher.html',
  styleUrl: './establishment-switcher.scss',
  host: { '[class.compact]': 'compact()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstablishmentSwitcher {
  readonly establishments = input.required<readonly Establishment[]>();
  readonly selected = input.required<Establishment | null>();
  readonly compact = input(false);
  readonly chosen = output<string>();
}
