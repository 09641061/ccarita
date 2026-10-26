import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { OpeningHoursStore } from '../../../application/opening-hours.store';
import {
  IsoWeekday,
  OpeningHours,
  OpeningRangeProblem,
  WEEKDAYS,
  rangeProblems,
} from '../../../domain/model/opening-hours';

interface TypedRange {
  opensAt: string;
  closesAt: string;
}

type Week = Record<IsoWeekday, readonly TypedRange[]>;

const CLOSED_WEEK = Object.fromEntries(WEEKDAYS.map((day) => [day, []])) as unknown as Week;
const DEFAULT_RANGE: TypedRange = { opensAt: '09:00', closesAt: '19:00' };

/**
 * Ajustes › Horario and the first step of Primeros pasos: the selected establishment's week (O8), for owners and
 * managers. Each day is closed or has one or more ranges, checked as pibble checks them before saving. Saving
 * replaces the whole week with a PUT, so it needs no idempotency key; an inactive plan disables it (O6).
 */
@Component({
  selector: 'app-opening-hours-editor',
  imports: [
    BusyButton,
    ErrorMessagePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    Skeleton,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './opening-hours-editor.html',
  styleUrls: ['../section.scss', './opening-hours-editor.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpeningHoursEditor {
  protected readonly store = inject(OpeningHoursStore);
  protected readonly organization = inject(CurrentOrganization);
  private readonly establishment = inject(CurrentEstablishment);

  protected readonly weekdays = WEEKDAYS;
  protected readonly week = signal<Week>(CLOSED_WEEK);
  protected readonly problems = computed(
    () =>
      Object.fromEntries(WEEKDAYS.map((day) => [day, rangeProblems(this.week()[day])])) as Record<
        IsoWeekday,
        readonly (OpeningRangeProblem | null)[]
      >,
  );
  protected readonly valid = computed(() =>
    WEEKDAYS.every((day) => this.problems()[day].every((problem) => problem === null)),
  );
  protected readonly attempted = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly saved = signal(false);
  protected readonly canChange = computed(() => this.organization.planActive());

  protected readonly loadError = computed(() => {
    const error = this.store.hours.error();
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
  /** The hours that filled the form, so a reload does not overwrite what is being typed. */
  private filledFrom: OpeningHours | null = null;

  constructor() {
    effect(() => {
      const hours = this.store.hours.hasValue() ? this.store.hours.value() : null;
      if (!hours || hours === this.filledFrom) return;
      this.filledFrom = hours;
      untracked(() => {
        this.week.set(
          Object.fromEntries(
            WEEKDAYS.map((day) => [
              day,
              hours.on(day).map(({ opensAt, closesAt }) => ({ opensAt, closesAt })),
            ]),
          ) as unknown as Week,
        );
        this.attempted.set(false);
        this.error.set(null);
      });
    });
  }

  /** A problem shows once both times are typed, or after trying to save. */
  protected problemOf(day: IsoWeekday, index: number): OpeningRangeProblem | null {
    const range = this.week()[day][index];
    const shown = this.attempted() || (range.opensAt !== '' && range.closesAt !== '');
    return shown ? this.problems()[day][index] : null;
  }

  protected toggle(day: IsoWeekday, open: boolean): void {
    const previous = WEEKDAYS.slice(0, day - 1)
      .reverse()
      .map((d) => this.week()[d])
      .find((ranges) => ranges.length > 0);
    this.setDay(day, open ? (previous ?? [DEFAULT_RANGE]).map((r) => ({ ...r })) : []);
  }

  protected add(day: IsoWeekday): void {
    this.setDay(day, [...this.week()[day], { opensAt: '', closesAt: '' }]);
  }

  protected remove(day: IsoWeekday, index: number): void {
    this.setDay(
      day,
      this.week()[day].filter((_, i) => i !== index),
    );
  }

  protected type(day: IsoWeekday, index: number, field: keyof TypedRange, value: string): void {
    this.setDay(
      day,
      this.week()[day].map((range, i) => (i === index ? { ...range, [field]: value } : range)),
    );
  }

  /** Gives every open day Monday's ranges. */
  protected copyMonday(): void {
    const monday = this.week()[1];
    for (const day of WEEKDAYS.slice(1)) {
      if (this.week()[day].length > 0)
        this.setDay(
          day,
          monday.map((r) => ({ ...r })),
        );
    }
  }

  protected async save(): Promise<void> {
    const id = this.establishment.id();
    this.attempted.set(true);
    if (!id || this.busy() || !this.valid()) return;
    const hours = new OpeningHours(
      WEEKDAYS.flatMap((weekday) => this.week()[weekday].map((range) => ({ weekday, ...range }))),
    );
    this.busy.set(true);
    this.error.set(null);
    try {
      this.filledFrom = await this.store.replace(id, hours);
      this.saved.set(true);
    } catch (error) {
      this.error.set(ApiError.of(error));
    } finally {
      this.busy.set(false);
    }
  }

  private setDay(day: IsoWeekday, ranges: readonly TypedRange[]): void {
    this.week.update((week) => ({ ...week, [day]: ranges }));
    this.saved.set(false);
  }
}
