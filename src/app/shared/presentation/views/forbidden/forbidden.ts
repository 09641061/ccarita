import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { StateView } from '../../components/state-view/state-view';

/** Where a role guard sends a destination the role cannot use (Estados del sistema: sin permiso). */
@Component({
  selector: 'app-forbidden',
  imports: [MatButtonModule, RouterLink, StateView, TranslatePipe],
  template: `
    <app-state-view kind="forbidden">
      <a matButton="tonal" routerLink="/agenda">{{ 'shared.nav.backToCalendar' | translate }}</a>
    </app-state-view>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Forbidden {}
