import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { environment } from '../../../../../environments/environment';
import { StateView } from '../../../../shared/presentation/components/state-view/state-view';
import { ZonedDatePipe } from '../../../../shared/presentation/pipes/zoned-date.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';

const LIMA = 'America/Lima';

/**
 * Ajustes › Facturación, for the owner (03 §5): the organization's plan, until when it is active, and how to renew
 * it (O5). pibble has no self-service payment, so renewing is a message to the Takodu team.
 */
@Component({
  selector: 'app-billing',
  imports: [MatButtonModule, MatIconModule, StateView, TranslatePipe, ZonedDatePipe],
  templateUrl: './billing.html',
  styleUrls: ['../section.scss', './billing.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Billing {
  protected readonly organization = inject(CurrentOrganization);
  private readonly establishment = inject(CurrentEstablishment);
  protected readonly renewalContact = environment.renewalContact;

  protected readonly timeZone = computed(() => this.establishment.timeZone() ?? LIMA);
  protected readonly plan = computed(() => {
    const details = this.organization.details;
    return details.hasValue() && details.value().id === this.organization.selected()?.id
      ? details.value().plan
      : null;
  });
}
