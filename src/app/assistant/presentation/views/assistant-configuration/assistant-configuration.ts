import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form, maxLength, readonly } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { WhatsappLineStore } from '../../../../conversations/public-api';
import { CurrentEstablishment, CurrentOrganization } from '../../../../organization/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { BrandMark } from '../../../../shared/presentation/components/brand-mark/brand-mark';
import { BusyButton } from '../../../../shared/presentation/components/busy-button/busy-button';
import { Skeleton } from '../../../../shared/presentation/components/skeleton/skeleton';
import {
  StateKind,
  StateView,
} from '../../../../shared/presentation/components/state-view/state-view';
import { ErrorMessagePipe } from '../../../../shared/presentation/pipes/error-message.pipe';
import { AssistantSettingsStore } from '../../../application/assistant-settings.store';
import { MAX_BUSINESS_INFO } from '../../../domain/model/assistant-settings';
import { SettingsLink } from '../../../../shared/presentation/navigation/settings-link';

/** What the status card says (A2), from what pibble lets the app know: the switch, the line and the plan. */
export type AssistantStatus = 'off' | 'answering' | 'noLine' | 'planInactive';

/** A5 and A6, as the cards list them. */
const CAN = ['explain', 'book', 'appointments', 'handOff'] as const;
const NEVER = ['discounts', 'invent', 'offTopic'] as const;

/**
 * Ajustes › Asistente and the last step of Primeros pasos, for owners and managers (03 §5): whether the assistant
 * answers the establishment's customers on WhatsApp, and the business info it may tell them (A1). The switch saves
 * the saved business info with the new state, since pibble replaces both; a PUT needs no idempotency key. A failed
 * save keeps the typed text; after a conflict the settings reload and the user saves again. An inactive plan
 * disables both (O6).
 */
@Component({
  selector: 'app-assistant-configuration',
  imports: [
    BrandMark,
    BusyButton,
    ErrorMessagePipe,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    SettingsLink,
    Skeleton,
    StateView,
    TranslatePipe,
  ],
  templateUrl: './assistant-configuration.html',
  styleUrl: './assistant-configuration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantConfiguration {
  protected readonly store = inject(AssistantSettingsStore);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);
  private readonly lines = inject(WhatsappLineStore);

  protected readonly max = MAX_BUSINESS_INFO;
  protected readonly can = CAN;
  protected readonly never = NEVER;

  protected readonly settings = computed(() =>
    this.store.settings.hasValue() ? this.store.settings.value() : null,
  );
  protected readonly line = computed(() =>
    this.lines.line.hasValue() ? this.lines.line.value() : null,
  );
  private readonly loadError = computed(() => {
    const error = this.store.settings.error();
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

  /** A2: a line that never existed counts as not connected; an unknown one (still loading) says nothing yet. */
  protected readonly status = computed<AssistantStatus | null>(() => {
    const settings = this.settings();
    if (!settings) return null;
    if (!settings.enabled) return 'off';
    if (!this.organization.planActive()) return 'planInactive';
    const line = this.line();
    const never = ApiError.of(this.lines.line.error() ?? null).code === 'WHATSAPP_LINE_NOT_FOUND';
    if (never || line?.connected === false) return 'noLine';
    return line ? 'answering' : null;
  });

  protected readonly canChange = computed(
    () => this.organization.can('editSettings') && this.organization.planActive(),
  );

  protected readonly model = signal({ businessInfo: '' });
  protected readonly infoForm = form(this.model, (path) => {
    maxLength(path.businessInfo, MAX_BUSINESS_INFO);
    readonly(path.businessInfo, () => !this.canChange());
  });
  protected readonly length = computed(() => this.model().businessInfo.length);
  protected readonly toggling = signal(false);
  protected readonly toggleError = signal<ApiError | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<ApiError | null>(null);
  protected readonly saved = signal(false);

  /** The establishment whose settings are loaded, so a reload after saving does not refill the form. */
  private readonly loadedFor = computed(() => this.settings()?.establishmentId ?? null);

  constructor() {
    effect(() => {
      if (!this.loadedFor()) return;
      untracked(() => {
        this.model.set({ businessInfo: this.settings()?.businessInfo ?? '' });
        this.saveError.set(null);
        this.toggleError.set(null);
        this.saved.set(false);
      });
    });
  }

  /** Turns it on or off with the business info pibble has, not an unsaved draft. */
  protected async toggle(change: MatSlideToggleChange): Promise<void> {
    const id = this.establishment.id();
    const settings = this.settings();
    if (!id || !settings || this.toggling()) return;
    this.toggling.set(true);
    this.toggleError.set(null);
    try {
      await this.store.save(id, { enabled: change.checked, businessInfo: settings.businessInfo });
    } catch (error) {
      change.source.checked = !change.checked;
      this.toggleError.set(ApiError.of(error));
    } finally {
      this.toggling.set(false);
    }
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    const id = this.establishment.id();
    const settings = this.settings();
    if (!id || !settings || this.saving() || this.infoForm().invalid()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(false);
    try {
      await this.store.save(id, {
        enabled: settings.enabled,
        businessInfo: this.model().businessInfo,
      });
      this.saved.set(true);
    } catch (error) {
      this.saveError.set(ApiError.of(error));
    } finally {
      this.saving.set(false);
    }
  }
}
