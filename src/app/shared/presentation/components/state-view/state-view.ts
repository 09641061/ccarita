import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

export type StateKind = 'empty' | 'error' | 'offline' | 'forbidden' | 'notFound';

const ICONS: Record<StateKind, string> = {
  empty: 'event_available',
  error: 'error',
  offline: 'wifi_off',
  forbidden: 'lock',
  notFound: 'search_off',
};

/**
 * The empty, error, offline, no-permission and not-found states of a screen (Estados del sistema).
 * Texts default to `shared.state.<kind>`; screens pass their own keys. Error and offline offer
 * retry; any other action (a "Nueva cita" button, a link back) is projected.
 */
@Component({
  selector: 'app-state-view',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './state-view.html',
  styleUrl: './state-view.scss',
  host: {
    '[attr.role]': "retryable() ? 'alert' : 'status'",
    '[class]': 'kind()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateView {
  readonly kind = input.required<StateKind>();
  /** Translation key of the title; defaults to `shared.state.<kind>.title`. */
  readonly title = input<string>();
  /** Translation key of the message; defaults to `shared.state.<kind>.message`. */
  readonly message = input<string>();
  readonly retry = output<void>();

  protected readonly icon = computed(() => ICONS[this.kind()]);
  protected readonly titleKey = computed(() => this.title() ?? `shared.state.${this.kind()}.title`);
  protected readonly messageKey = computed(
    () => this.message() ?? `shared.state.${this.kind()}.message`,
  );
  protected readonly retryable = computed(
    () => this.kind() === 'error' || this.kind() === 'offline',
  );
}
