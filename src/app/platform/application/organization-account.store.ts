import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { UsagePeriod } from '../../shared/domain/model/usage-period';
import { OPERATOR_TIME_ZONE } from '../domain/model/organization-account';
import { ChangePlan, PlanChange } from '../domain/model/plan-change';
import { OrganizationAccountsApi } from '../infrastructure/organization-accounts.api';
import { PlanChangesApi } from '../infrastructure/plan-changes.api';
import { OrganizationAccountsStore } from './organization-accounts.store';

/** The days the usage section opens with. */
export const DEFAULT_USAGE_DAYS = 30;

/**
 * One organization as the Takodu team sees it: its account from the list (pibble serves no single one), its plan
 * history (O5), its assistant usage over a period (A9), and recording a plan change.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationAccountStore {
  private readonly accountsApi = inject(OrganizationAccountsApi);
  private readonly planChangesApi = inject(PlanChangesApi);
  private readonly accounts = inject(OrganizationAccountsStore);

  readonly organizationId = signal<string | null>(null);
  private readonly chosen = signal<UsagePeriod | null>(null);

  /** `undefined` while the list loads, `null` when no organization has the id. */
  readonly account = computed(() => {
    const id = this.organizationId();
    return id ? this.accounts.find(id) : null;
  });

  readonly history = rxResource({
    params: () => this.organizationId() ?? undefined,
    stream: ({ params }) => this.planChangesApi.list(params),
    defaultValue: [],
  });

  /** The chosen period, else the last 30 days in Lima, the team's zone. */
  readonly period = computed(
    () => this.chosen() ?? UsagePeriod.lastDays(DEFAULT_USAGE_DAYS, new Date(), OPERATOR_TIME_ZONE),
  );

  readonly usage = rxResource({
    params: () => {
      const organizationId = this.organizationId();
      return organizationId ? { organizationId, period: this.period() } : undefined;
    },
    stream: ({ params }) => this.accountsApi.usage(params.organizationId, params.period),
  });

  open(organizationId: string): void {
    this.organizationId.set(organizationId);
  }

  choose(period: UsagePeriod): void {
    if (!period.equals(this.period())) this.chosen.set(period);
  }

  /** O5: records the change, then reloads the list (its order follows the end) and the history. */
  async changePlan(change: ChangePlan, idempotencyKey: string): Promise<PlanChange> {
    const organizationId = this.organizationId();
    if (!organizationId) throw new Error('No organization is open');
    const entry = await firstValueFrom(
      this.planChangesApi.change(organizationId, change, idempotencyKey),
    );
    this.accounts.accounts.reload();
    this.history.reload();
    return entry;
  }
}
