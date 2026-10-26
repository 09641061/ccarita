import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { SessionStore } from '../../iam/public-api';
import { OrganizationAccount } from '../domain/model/organization-account';
import { OrganizationAccountsApi } from '../infrastructure/organization-accounts.api';

/** Every organization for the Takodu team, the plan ending soonest first as pibble sends them, and a search. */
@Injectable({ providedIn: 'root' })
export class OrganizationAccountsStore {
  private readonly api = inject(OrganizationAccountsApi);
  private readonly session = inject(SessionStore);

  readonly accounts = rxResource({
    params: () => this.session.user()?.id,
    stream: () => this.api.list(),
    defaultValue: [],
  });

  /** What the search box holds; matches the business name or the owner's email. */
  readonly query = signal('');

  readonly visible = computed<readonly OrganizationAccount[]>(() => {
    const query = this.query();
    return this.accounts.value().filter((account) => account.matches(query));
  });

  /** The account with this id once the list has loaded; `undefined` while loading, `null` when there is none. */
  find(organizationId: string): OrganizationAccount | null | undefined {
    const found = this.accounts.value().find((account) => account.id === organizationId);
    if (found) return found;
    const status = this.accounts.status();
    return status === 'resolved' || status === 'local' ? null : undefined;
  }
}
