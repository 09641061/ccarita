/** One Material 3 color role and the Takodu token that fills it, in light and dark. */
export interface ThemeRole {
  readonly role: string;
  readonly token: string;
  readonly light: string;
  readonly dark: string;
}

/**
 * Every M3 color role ccarita sets, mirrored by `$roles` in `src/styles.scss`.
 * `scripts/check-theme.mjs` compiles the styles and fails if one is missing or differs,
 * because `mat.theme-overrides` drops unknown role names without an error.
 */
export const THEME_ROLES: readonly ThemeRole[] = [
  { role: 'primary', token: 'accent', light: '#33C19A', dark: '#33C19A' },
  { role: 'on-primary', token: 'accent-fg', light: '#04261C', dark: '#04261C' },
  { role: 'primary-container', token: 'accent-soft', light: '#D6F5EC', dark: '#0F3A2F' },
  { role: 'on-primary-container', token: 'accent-strong', light: '#0E7A5E', dark: '#5EE0BA' },
  { role: 'inverse-primary', token: 'accent-strong (swapped)', light: '#5EE0BA', dark: '#0E7A5E' },
  { role: 'surface-tint', token: 'accent', light: '#33C19A', dark: '#33C19A' },
  { role: 'secondary', token: 'accent-strong', light: '#0E7A5E', dark: '#5EE0BA' },
  { role: 'on-secondary', token: 'surface · accent-fg', light: '#FFFFFF', dark: '#04261C' },
  { role: 'secondary-container', token: 'accent-soft', light: '#D6F5EC', dark: '#0F3A2F' },
  { role: 'on-secondary-container', token: 'accent-strong', light: '#0E7A5E', dark: '#5EE0BA' },
  { role: 'tertiary', token: 'st-sch', light: '#3B4F7A', dark: '#A9BDF0' },
  { role: 'on-tertiary', token: 'surface · bg', light: '#FFFFFF', dark: '#0B1120' },
  { role: 'tertiary-container', token: 'st-sch-bg', light: '#E6ECF7', dark: '#1B2741' },
  { role: 'on-tertiary-container', token: 'st-sch', light: '#3B4F7A', dark: '#A9BDF0' },
  { role: 'error', token: 'danger', light: '#B42318', dark: '#F4877C' },
  { role: 'on-error', token: 'surface · danger-bg', light: '#FFFFFF', dark: '#3A1714' },
  { role: 'error-container', token: 'danger-bg', light: '#FDE8E6', dark: '#3A1714' },
  { role: 'on-error-container', token: 'danger', light: '#B42318', dark: '#F4877C' },
  { role: 'background', token: 'bg', light: '#F8FAFC', dark: '#0B1120' },
  { role: 'on-background', token: 'text', light: '#0F172A', dark: '#E8EDF5' },
  { role: 'surface', token: 'surface', light: '#FFFFFF', dark: '#111827' },
  { role: 'on-surface', token: 'text', light: '#0F172A', dark: '#E8EDF5' },
  { role: 'surface-variant', token: 'surface-2', light: '#F1F5F9', dark: '#1A2333' },
  { role: 'on-surface-variant', token: 'text-muted', light: '#526077', dark: '#9AA7BB' },
  { role: 'surface-dim', token: 'surface-2 · bg', light: '#F1F5F9', dark: '#0B1120' },
  { role: 'surface-bright', token: 'surface · surface-2', light: '#FFFFFF', dark: '#1A2333' },
  { role: 'surface-container-lowest', token: 'surface · bg', light: '#FFFFFF', dark: '#0B1120' },
  { role: 'surface-container-low', token: 'bg', light: '#F8FAFC', dark: '#0B1120' },
  { role: 'surface-container', token: 'surface-2', light: '#F1F5F9', dark: '#1A2333' },
  { role: 'surface-container-high', token: 'surface-2', light: '#F1F5F9', dark: '#1A2333' },
  { role: 'surface-container-highest', token: 'border', light: '#E2E8F0', dark: '#243044' },
  { role: 'inverse-surface', token: 'text', light: '#0F172A', dark: '#E8EDF5' },
  { role: 'inverse-on-surface', token: 'bg', light: '#F8FAFC', dark: '#0B1120' },
  { role: 'outline', token: 'border-strong', light: '#CBD5E1', dark: '#34435C' },
  { role: 'outline-variant', token: 'border', light: '#E2E8F0', dark: '#243044' },
];
