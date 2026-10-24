import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'ccarita.tenant';

interface Selection {
  readonly organizationId: string | null;
  readonly establishmentId: string | null;
}

/**
 * The organization and establishment the user works in. `tenantInterceptor` sends the organization as
 * `X-Organization-Id`; screens read the establishment. Kept in local storage so a reload stays in place.
 */
@Injectable({ providedIn: 'root' })
export class TenantContext {
  private readonly selection = signal<Selection>(restore());

  readonly organizationId = computed(() => this.selection().organizationId);
  readonly establishmentId = computed(() => this.selection().establishmentId);

  selectOrganization(organizationId: string): void {
    if (organizationId === this.organizationId()) return;
    this.save({ organizationId, establishmentId: null });
  }

  selectEstablishment(establishmentId: string): void {
    this.save({ ...this.selection(), establishmentId });
  }

  clear(): void {
    this.save({ organizationId: null, establishmentId: null });
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
    return {
      organizationId: stored?.organizationId ?? null,
      establishmentId: stored?.establishmentId ?? null,
    };
  } catch {
    return { organizationId: null, establishmentId: null };
  }
}
