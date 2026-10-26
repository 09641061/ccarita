import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { SessionStore } from '../../../../iam/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { newIdempotencyKey } from '../../../../shared/domain/model/idempotency-key';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { StateView } from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { ESTABLISHMENT_LINE } from '../../../application/establishment-line';
import { EstablishmentTeam } from '../../../application/establishment-team.store';
import { OpeningHoursStore } from '../../../application/opening-hours.store';

interface CreateModel {
  name: string;
  establishmentName: string;
  address: string;
  ownerDisplayName: string;
}

/** One step of the checklist, done when pibble reports it. */
export interface OnboardingStep {
  readonly path: 'horario' | 'servicios' | 'whatsapp';
  readonly key: 'hours' | 'services' | 'whatsapp';
  readonly done: boolean;
  /** How many open days or services, for the step's line. */
  readonly count: number;
}

/**
 * Primeros pasos. A user without an organization creates one with its first establishment (O1) and becomes its
 * owner; the owner then walks the steps of the selected establishment, each the screen Ajustes shows: opening
 * hours, services and the WhatsApp line. A step is done when pibble says so; turning on the assistant and inviting
 * the team come in later phases. Creating sends one idempotency key per attempt, reused on a retry after a lost
 * answer and renewed when the form changes.
 */
@Component({
  selector: 'app-onboarding',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    RouterLink,
    RouterOutlet,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Onboarding {
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);
  private readonly hours = inject(OpeningHoursStore);
  private readonly team = inject(EstablishmentTeam);
  private readonly line = inject(ESTABLISHMENT_LINE);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<ApiError | null>(null);

  protected readonly steps = computed<readonly OnboardingStep[]>(() => {
    const hours = this.hours.hours.hasValue() ? this.hours.hours.value() : null;
    const services = this.team.services.value();
    return [
      {
        path: 'horario',
        key: 'hours',
        done: hours?.isSet ?? false,
        count: hours?.openWeekdays.length ?? 0,
      },
      { path: 'servicios', key: 'services', done: services.length > 0, count: services.length },
      { path: 'whatsapp', key: 'whatsapp', done: this.line.connected() === true, count: 0 },
    ];
  });
  protected readonly doneCount = computed(() => this.steps().filter((step) => step.done).length);
  /** Whether pibble has answered for hours and services, so the first pending step is known. */
  private readonly known = computed(
    () =>
      (this.hours.hours.hasValue() || !!this.hours.hours.error()) &&
      !this.team.services.isLoading(),
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly current = computed(() => {
    const path = this.url().split(/[?#]/)[0].split('/')[2];
    return this.steps().findIndex((step) => step.path === path);
  });

  protected readonly model = signal<CreateModel>({
    name: '',
    establishmentName: '',
    address: '',
    ownerDisplayName: this.session.user()?.name ?? '',
  });
  protected readonly createForm = form(this.model, (path) => {
    required(path.name);
    required(path.establishmentName);
    required(path.ownerDisplayName);
    maxLength(path.name, 120);
    maxLength(path.establishmentName, 120);
    maxLength(path.address, 300);
    maxLength(path.ownerDisplayName, 120);
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  private key = newIdempotencyKey();
  private keyInput: string | null = null;

  constructor() {
    void this.load();
    effect(() => {
      if (this.loading() || !this.isOwner() || this.current() !== -1 || !this.known()) return;
      const pending = this.steps().find((step) => !step.done);
      if (pending) untracked(() => this.go(pending.path));
    });
  }

  protected readonly isOwner = computed(() => this.organization.role() === 'owner');

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const organizations = await this.organization.load();
      if (organizations.length > 0 && !this.organization.selected()) {
        void this.router.navigate(['/organizaciones'], {
          queryParams: { volver: '/primeros-pasos' },
        });
      }
    } catch (error) {
      this.loadError.set(ApiError.of(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async create(event?: Event): Promise<void> {
    event?.preventDefault();
    this.createForm().markAsTouched();
    const model = this.model();
    const blank = [model.name, model.establishmentName, model.ownerDisplayName].some(
      (value) => !value.trim(),
    );
    if (this.busy() || this.createForm().invalid() || blank) return;
    const input = JSON.stringify(model);
    if (this.keyInput !== null && this.keyInput !== input) this.key = newIdempotencyKey();
    this.keyInput = input;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.organization.create(
        {
          name: model.name,
          establishment: { name: model.establishmentName, address: model.address, timeZone: '' },
          ownerDisplayName: model.ownerDisplayName,
        },
        this.key,
      );
      this.key = newIdempotencyKey();
      this.keyInput = null;
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

  /** The next step, or the calendar after the last one. */
  protected next(): void {
    const following = this.steps()[this.current() + 1];
    if (following) this.go(following.path);
    else void this.router.navigate(['/agenda']);
  }

  private go(path: string): void {
    void this.router.navigate(['/primeros-pasos', path], { replaceUrl: this.current() === -1 });
  }
}
