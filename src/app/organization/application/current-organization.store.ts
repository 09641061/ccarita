import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../iam/public-api';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { JoinedOrganization } from '../domain/model/joined-organization';
import { MemberAction, MemberRole, canPerform } from '../domain/model/member-role';
import { InvitationAcceptancesApi } from '../infrastructure/invitation-acceptances.api';
import { OrganizationsApi } from '../infrastructure/organizations.api';

interface Joined {
  readonly userId: string;
  readonly organizations: readonly JoinedOrganization[];
}

/**
 * The organizations of the signed-in user and the one they work in. The selection lives in `TenantContext`; the
 * role and plan always come from pibble, never from a form. A stored selection that is no longer a membership is
 * dropped; with a single organization it is selected without asking.
 */
@Injectable({ providedIn: 'root' })
export class CurrentOrganization {
  private readonly api = inject(OrganizationsApi);
  private readonly invitations = inject(InvitationAcceptancesApi);
  private readonly session = inject(SessionStore);
  private readonly tenant = inject(TenantContext);
  private readonly joined = signal<Joined | null>(null);
  private loading: Promise<readonly JoinedOrganization[]> | null = null;

  /** The memberships of the signed-in user, or `null` before they are loaded. */
  readonly organizations = computed(() => {
    const joined = this.joined();
    return joined && joined.userId === this.session.user()?.id ? joined.organizations : null;
  });
  readonly selected = computed(
    () => this.organizations()?.find((o) => o.id === this.tenant.organizationId()) ?? null,
  );
  readonly role = computed<MemberRole | null>(() => this.selected()?.role ?? null);

  /** `GET /organization`: the plan and its end as pibble has them now. */
  readonly details = rxResource({
    params: () => this.selected()?.id,
    stream: () => this.api.current(),
  });

  readonly planActiveUntil = computed<Date | null>(
    () => this.detailsValue()?.planActiveUntil ?? this.selected()?.planActiveUntil ?? null,
  );

  /** O5, O6: false while the plan has ended; true until an organization is known. */
  readonly planActive = computed(() => {
    const until = this.planActiveUntil();
    return until === null || this.planActiveAt(new Date());
  });

  /** 03 §5 for the selected organization's role. */
  can(action: MemberAction): boolean {
    const role = this.role();
    return role !== null && canPerform(role, action);
  }

  planActiveAt(now: Date): boolean {
    const details = this.detailsValue();
    if (details) return details.planActive(now);
    return this.selected()?.planActive(now) ?? true;
  }

  /**
   * Loads the memberships once per signed-in user (`reload` forces it), drops a selection that is not one of them,
   * and selects the only organization when there is one.
   * @throws ApiError when pibble cannot list them.
   */
  async load(reload = false): Promise<readonly JoinedOrganization[]> {
    const known = this.organizations();
    if (known && !reload) return known;
    this.loading ??= this.fetch().finally(() => (this.loading = null));
    return this.loading;
  }

  select(organizationId: string): void {
    this.tenant.selectOrganization(organizationId);
  }

  /**
   * O10: joins the organization of an invitation and selects it.
   * @throws ApiError `INVITATION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_CONFLICT`, `ACCESS_DENIED`.
   */
  async acceptInvitation(token: string): Promise<JoinedOrganization> {
    const joined = await firstValueFrom(this.invitations.accept(token));
    await this.load(true);
    this.select(joined.id);
    return joined;
  }

  private async fetch(): Promise<readonly JoinedOrganization[]> {
    const userId = this.session.user()?.id;
    const organizations = await firstValueFrom(this.api.listJoined());
    if (userId) this.joined.set({ userId, organizations });
    const selectedId = this.tenant.organizationId();
    if (selectedId && !organizations.some((o) => o.id === selectedId)) this.tenant.clear();
    if (!this.tenant.organizationId() && organizations.length === 1)
      this.select(organizations[0].id);
    return organizations;
  }

  /** The details of the selected organization only, never those of the previous one while reloading. */
  private detailsValue() {
    const details = this.details.hasValue() ? this.details.value() : undefined;
    return details?.id === this.selected()?.id ? details : undefined;
  }
}
