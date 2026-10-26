/** pibble's member roles; organization's role type is the same union. */
export type MemberRoleKind = 'owner' | 'manager' | 'staff';

/** One destination of the main navigation; the drawer and the phone's bottom bar show the same ones. */
export interface NavigationItem {
  readonly path: string;
  /** Translation key of the label. */
  readonly label: string;
  /** Material Symbols name. */
  readonly icon: string;
  readonly roles: readonly MemberRoleKind[];
}

/**
 * The daily destinations (03 §5); each role sees only what it can do, and pibble still enforces it. Settings,
 * the organization and the account live in the settings center, opened from the profile menu.
 */
export const MAIN_NAVIGATION: readonly NavigationItem[] = [
  {
    path: '/agenda',
    label: 'shared.nav.calendar',
    icon: 'calendar_month',
    roles: ['owner', 'manager', 'staff'],
  },
  {
    path: '/bandeja',
    label: 'shared.nav.inbox',
    icon: 'inbox',
    roles: ['owner', 'manager', 'staff'],
  },
  {
    path: '/clientes',
    label: 'shared.nav.customers',
    icon: 'group',
    roles: ['owner', 'manager', 'staff'],
  },
  { path: '/equipo', label: 'shared.nav.team', icon: 'badge', roles: ['owner', 'manager'] },
];

export function navigationFor(role: MemberRoleKind): readonly NavigationItem[] {
  return MAIN_NAVIGATION.filter((item) => item.roles.includes(role));
}

/** The destination a URL belongs to: the item whose path is the URL's path or a prefix of it. */
export function activeItem(items: readonly NavigationItem[], url: string): NavigationItem | null {
  const path = url.split(/[?#]/)[0];
  return items.find((item) => path === item.path || path.startsWith(`${item.path}/`)) ?? null;
}
