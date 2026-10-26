/** pibble's member roles; organization's role type is the same union. */
export type MemberRoleKind = 'owner' | 'manager' | 'staff';

/** One destination of the main navigation. */
export interface NavigationItem {
  readonly path: string;
  /** Translation key of the label. */
  readonly label: string;
  /** Material Symbols name; ignored when `assistant` is true, which shows the brand mark. */
  readonly icon: string;
  readonly assistant?: boolean;
  /** `bar`: in the phone's bottom bar; `more`: on the "Más" page. The drawer shows both. */
  readonly placement: 'bar' | 'more';
  readonly roles: readonly MemberRoleKind[];
  /** Other paths that belong to this destination, such as a screen it opens inside another one. */
  readonly also?: readonly string[];
}

/** Mapa por rol and 03 §5: each role sees only what it can do; pibble still enforces it. */
export const MAIN_NAVIGATION: readonly NavigationItem[] = [
  {
    path: '/agenda',
    label: 'shared.nav.calendar',
    icon: 'calendar_month',
    placement: 'bar',
    roles: ['owner', 'manager', 'staff'],
  },
  {
    path: '/bandeja',
    label: 'shared.nav.inbox',
    icon: 'inbox',
    placement: 'bar',
    roles: ['owner', 'manager', 'staff'],
  },
  {
    path: '/clientes',
    label: 'shared.nav.customers',
    icon: 'group',
    placement: 'bar',
    roles: ['owner', 'manager', 'staff'],
  },
  {
    path: '/asistente',
    label: 'shared.nav.assistant',
    icon: '',
    assistant: true,
    placement: 'bar',
    roles: ['owner', 'manager'],
    also: ['/ajustes/asistente', '/ajustes/uso'],
  },
  {
    path: '/equipo',
    label: 'shared.nav.team',
    icon: 'badge',
    placement: 'more',
    roles: ['owner', 'manager'],
  },
  {
    path: '/ajustes',
    label: 'shared.nav.settings',
    icon: 'storefront',
    placement: 'more',
    roles: ['owner', 'manager'],
  },
  {
    path: '/organizacion',
    label: 'shared.nav.organization',
    icon: 'domain',
    placement: 'more',
    roles: ['owner'],
  },
  {
    path: '/cuenta',
    label: 'shared.nav.account',
    icon: 'account_circle',
    placement: 'more',
    roles: ['owner', 'manager', 'staff'],
  },
];

export function navigationFor(role: MemberRoleKind): readonly NavigationItem[] {
  return MAIN_NAVIGATION.filter((item) => item.roles.includes(role));
}

/**
 * The destination a URL belongs to: the item whose path, or one of its `also` paths, is the longest prefix of it, so
 * `/ajustes/uso` is the assistant's and `/ajustes/horario` is Ajustes'.
 */
export function activeItem(items: readonly NavigationItem[], url: string): NavigationItem | null {
  const path = url.split(/[?#]/)[0];
  let best: NavigationItem | null = null;
  let length = 0;
  for (const item of items) {
    for (const prefix of [item.path, ...(item.also ?? [])]) {
      const matches = path === prefix || path.startsWith(`${prefix}/`);
      if (matches && prefix.length > length) {
        best = item;
        length = prefix.length;
      }
    }
  }
  return best;
}
