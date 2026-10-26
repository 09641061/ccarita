import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { StateView } from '../../../../shared/presentation/components/state-view/state-view';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { MemberAction } from '../../../domain/model/member-role';

/** One section of Ajustes. */
export interface SettingsTab {
  readonly path: string;
  readonly label: string;
  /** 03 §5: who sees the section; pibble still decides. */
  readonly action: MemberAction;
}

export const SETTINGS_TABS: readonly SettingsTab[] = [
  { path: 'datos', label: 'organization.settings.tabs.details', action: 'manageEstablishments' },
  { path: 'horario', label: 'organization.settings.tabs.hours', action: 'editSettings' },
  { path: 'servicios', label: 'organization.settings.tabs.services', action: 'editSettings' },
  { path: 'whatsapp', label: 'organization.settings.tabs.whatsapp', action: 'connectWhatsapp' },
  { path: 'asistente', label: 'organization.settings.tabs.assistant', action: 'editSettings' },
  { path: 'uso', label: 'organization.settings.tabs.usage', action: 'editSettings' },
];

/**
 * Ajustes: the selected establishment's sections as tabs, each a child route. Owners see all of them; managers
 * the hours, services, assistant and usage (Mapa por rol, 03 §5). The WhatsApp section belongs to `conversations`
 * and the assistant's to `assistant`; the app's routes mount them.
 */
@Component({
  selector: 'app-settings',
  imports: [MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet, StateView, TranslatePipe],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly router = inject(Router);
  protected readonly organization = inject(CurrentOrganization);
  protected readonly establishment = inject(CurrentEstablishment);

  protected readonly tabs = computed(() =>
    SETTINGS_TABS.filter((tab) => this.organization.can(tab.action)),
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly current = computed(() => {
    const path = this.url().split(/[?#]/)[0].split('/').pop();
    return SETTINGS_TABS.find((tab) => tab.path === path) ?? null;
  });
}
