import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { EstablishmentTeam } from '../../../application/establishment-team.store';
import { ServiceCatalog } from '../../../application/service-catalog.store';
import { Service } from '../../../domain/model/service';
import { ServiceDetails } from '../../../domain/model/service-details';
import { ServiceForm } from '../../components/service-form/service-form';

/**
 * Ajustes › Servicios and the second step of Primeros pasos, for owners and managers: the establishment's services,
 * active and deactivated (O14), creating and editing them with their performers (O15), and turning them on and
 * off. Creating sends one idempotency key per attempt, reused on a retry after a lost answer and renewed when the
 * form changes; edits are PUTs and activations repeat safely, so they send none. An inactive plan disables every
 * change (O6).
 */
@Component({
  selector: 'app-service-list',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    ServiceForm,
    Skeleton,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './service-list.html',
  styleUrls: ['../section.scss', './service-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceList {
  protected readonly team = inject(EstablishmentTeam);
  protected readonly organization = inject(CurrentOrganization);
  private readonly catalog = inject(ServiceCatalog);
  private readonly establishment = inject(CurrentEstablishment);

  protected readonly active = computed(() => this.team.services.value().filter((s) => s.active));
  protected readonly inactive = computed(() => this.team.services.value().filter((s) => !s.active));
  protected readonly canChange = computed(() => this.organization.planActive());
  protected readonly loadError = computed(() => {
    const error = this.team.services.error();
    return error ? ApiError.of(error) : null;
  });
  protected readonly errorKind = computed<StateKind>(() => {
    switch (this.loadError()?.code) {
      case 'ACCESS_DENIED':
        return 'forbidden';
      case 'NETWORK_ERROR':
        return 'offline';
      default:
        return 'error';
    }
  });

  /** `new`, the service being edited, or `null` while listing. */
  protected readonly editing = signal<Service | 'new' | null>(null);
  protected readonly editedService = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  /** The service being turned on or off, and what failed. */
  protected readonly toggling = signal<string | null>(null);
  protected readonly toggleError = signal<{ id: string; error: ApiError } | null>(null);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;

  protected edit(service: Service | 'new'): void {
    this.editing.set(service);
    this.error.set(null);
  }

  protected close(): void {
    this.editing.set(null);
    this.error.set(null);
  }

  protected async save(details: ServiceDetails): Promise<void> {
    const editing = this.editing();
    const establishmentId = this.establishment.id();
    if (!editing || !establishmentId || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (editing === 'new') await this.create(establishmentId, details);
      else await this.catalog.update(editing.id, details);
      this.editing.set(null);
    } catch (error) {
      const failure = ApiError.of(error);
      this.error.set(failure);
      if (!failure.retryable) {
        this.key = newIdempotencyKey();
        this.keyInput = null;
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async setActive(service: Service, active: boolean): Promise<void> {
    if (this.toggling()) return;
    this.toggling.set(service.id);
    this.toggleError.set(null);
    try {
      await this.catalog.setActive(service.id, active);
    } catch (error) {
      this.toggleError.set({ id: service.id, error: ApiError.of(error) });
    } finally {
      this.toggling.set(null);
    }
  }

  /** O14. A retry after a lost answer sends the same key, so the service is created once. */
  private async create(establishmentId: string, details: ServiceDetails): Promise<void> {
    const input = JSON.stringify(details);
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    await this.catalog.create(establishmentId, details, this.key);
    this.key = newIdempotencyKey();
    this.keyInput = null;
  }
}
