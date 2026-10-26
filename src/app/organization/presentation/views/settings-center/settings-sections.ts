import { MemberAction } from '../../../domain/model/member-role';
import { ScreenLoader, SettingsScreens } from '../../settings-screens';

/** The headings the section list groups by, named for what the user tunes, like Claude's settings. */
export type SettingsGroup = 'general' | 'service' | 'messaging';

/** What a section configures; `establishment` sections act on the selected establishment. */
export type SettingsScope = 'account' | 'establishment' | 'organization';

/** One section of the settings center; its id is the value of `?ajustes=`. */
export interface SettingsSection {
  readonly id: string;
  readonly group: SettingsGroup;
  readonly scope: SettingsScope;
  /** Translation key of the label, also the section's title. */
  readonly label: string;
  readonly icon: string;
  /** 03 §5: who sees it; `null` for everyone. pibble still decides. */
  readonly action: MemberAction | null;
  readonly load: ScreenLoader;
}

/** The sections in order, as the center lists them; who sees each follows 03 §5. */
export function settingsSections(screens: SettingsScreens): readonly SettingsSection[] {
  return [
    {
      id: 'cuenta',
      group: 'general',
      scope: 'account',
      label: 'organization.settingsCenter.sections.account',
      icon: 'account_circle',
      action: null,
      load: () => import('../../../../iam/public-api').then((m) => m.Account),
    },
    {
      id: 'organizacion',
      group: 'general',
      scope: 'organization',
      label: 'organization.settingsCenter.sections.organization',
      icon: 'domain',
      action: 'editOrganization',
      load: () => import('../organization-page/organization-page').then((m) => m.OrganizationPage),
    },
    {
      id: 'datos',
      group: 'service',
      scope: 'establishment',
      label: 'organization.settingsCenter.sections.details',
      icon: 'storefront',
      action: 'manageEstablishments',
      load: () =>
        import('../establishment-details/establishment-details').then(
          (m) => m.EstablishmentDetails,
        ),
    },
    {
      id: 'horario',
      group: 'service',
      scope: 'establishment',
      label: 'organization.settingsCenter.sections.hours',
      icon: 'schedule',
      action: 'editSettings',
      load: () =>
        import('../opening-hours-editor/opening-hours-editor').then((m) => m.OpeningHoursEditor),
    },
    {
      id: 'servicios',
      group: 'service',
      scope: 'establishment',
      label: 'organization.settingsCenter.sections.services',
      icon: 'content_cut',
      action: 'editSettings',
      load: () => import('../service-list/service-list').then((m) => m.ServiceList),
    },
    {
      id: 'whatsapp',
      group: 'messaging',
      scope: 'establishment',
      label: 'organization.settingsCenter.sections.whatsapp',
      icon: 'chat',
      action: 'connectWhatsapp',
      load: screens.whatsapp,
    },
    {
      id: 'asistente',
      group: 'messaging',
      scope: 'establishment',
      label: 'organization.settingsCenter.sections.assistant',
      icon: 'smart_toy',
      action: 'editSettings',
      load: screens.assistant,
    },
    {
      id: 'uso',
      group: 'messaging',
      scope: 'establishment',
      label: 'organization.settingsCenter.sections.usage',
      icon: 'bar_chart',
      action: 'editSettings',
      load: screens.usage,
    },
  ];
}
