import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'ccarita.tenant';

interface Selection {
  readonly organizationId: string | null;
  /** The last establishment chosen in each organization, by organization id. */
  readonly establishments: Readonly<Record<string, string>>;
}

const EMPTY: Selection = { organizationId: null, establishments: {} };

/**
 * The organization and establishment the user works in. `tenantInterceptor` sends the organization as
 * `X-Organization-Id`; screens read the establishment. Kept in local storage so a reload stays in place, and each
 * organization remembers its own establishment.
 */
@Injectable({ providedIn: 'root' })
export class TenantContext {
  private readonly selection = signal<Selection>(restore());

  readonly organizationId = computed(() => this.selection().organizationId);
  readonly establishmentId = computed(() => {
    const { organizationId, establishments } = this.selection();
    return organizationId ? (establishments[organizationId] ?? null) : null;
  });

  selectOrganization(organizationId: string): void {
    if (organizationId === this.organizationId()) return;
    this.save({ ...this.selection(), organizationId });
  }

  /** Remembers the establishment for the selected organization; ignored when none is selected. */
  selectEstablishment(establishmentId: string): void {
    const { organizationId, establishments } = this.selection();
    if (!organizationId) return;
    this.save({
      organizationId,
      establishments: { ...establishments, [organizationId]: establishmentId },
    });
  }

  clear(): void {
    this.save(EMPTY);
  }

  private save(selection: Selection): void {
    this.selection.set(selection);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      // Storage can be unavailable (private mode); the selection still lives for this tab.
    }
  }
}

function restore(): Selection {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<Selection> | null;
    const establishments = stored?.establishments;
    return {
      organizationId: typeof stored?.organizationId === 'string' ? stored.organizationId : null,
      establishments: establishments && typeof establishments === 'object' ? establishments : {},
    };
  } catch {
    return EMPTY;
  }
}
