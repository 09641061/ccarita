import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../shared/domain/model/api-error';
import { LocalDate } from '../../shared/domain/model/local-date';
import { UsagePeriod } from '../../shared/domain/model/usage-period';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { TenantContext } from '../../shared/infrastructure/tenancy/tenant-context';
import { tenantInterceptor } from '../../shared/infrastructure/tenancy/tenant.interceptor';
import { OperatorApi } from './operator.api';
import { OrganizationAccountsApi } from './organization-accounts.api';
import { PlanChangesApi } from './plan-changes.api';

const API = 'http://api.test';

describe('platform endpoints', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([tenantInterceptor, idempotencyInterceptor, apiErrorInterceptor]),
        ),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(TenantContext).selectOrganization('org-mine');
  });

  afterEach(() => backend.verify());

  it('checks the operator without the tenant header, and reports 403 as ACCESS_DENIED', async () => {
    const call = firstValueFrom(TestBed.inject(OperatorApi).check());

    const request = backend.expectOne(`${API}/internal/v1/operator`);
    expect(request.request.headers.has('X-Organization-Id')).toBe(false);
    request.flush(
      { code: 'ACCESS_DENIED', message: 'x' },
      { status: 403, statusText: 'Forbidden' },
    );

    await expect(call).rejects.toMatchObject({ status: 403, code: 'ACCESS_DENIED' });
    await call.catch((error) => expect(error).toBeInstanceOf(ApiError));
  });

  it('lists organizations with their plan, owner and establishments', async () => {
    const call = firstValueFrom(TestBed.inject(OrganizationAccountsApi).list());

    const request = backend.expectOne(`${API}/internal/v1/organizations`);
    expect(request.request.headers.has('X-Organization-Id')).toBe(false);
    request.flush([
      {
        id: 'org-1',
        name: 'Barbería Don Lucho',
        plan: 'standard',
        planActiveUntil: '2026-11-06T05:00:00Z',
        planActive: true,
        ownerEmail: 'luis@donlucho.pe',
        activeEstablishments: 2,
      },
    ]);

    const [account] = await call;
    expect(account).toMatchObject({ id: 'org-1', plan: 'standard', activeEstablishments: 2 });
    expect(account.planActiveUntil).toEqual(new Date('2026-11-06T05:00:00Z'));
    expect(account.overLimit).toBe(true);
  });

  it('reads the plan history', async () => {
    const call = firstValueFrom(TestBed.inject(PlanChangesApi).list('org-1'));

    backend.expectOne(`${API}/internal/v1/organizations/org-1/plan-changes`).flush([
      {
        id: 'pc-1',
        organizationId: 'org-1',
        fromPlan: 'max',
        toPlan: 'standard',
        fromActiveUntil: '2026-11-06T05:00:00Z',
        toActiveUntil: '2026-12-06T05:00:00Z',
        note: 'Yape 2026-10-23',
        changedBy: 'u-ops',
        changedByEmail: 'ops@takodu.pe',
        changedAt: '2026-10-23T15:00:00Z',
      },
    ]);

    const [entry] = await call;
    expect(entry).toMatchObject({ toPlan: 'standard', note: 'Yape 2026-10-23', planChanged: true });
    expect(entry.toActiveUntil).toEqual(new Date('2026-12-06T05:00:00Z'));
  });

  it('O5: changes the plan with an idempotency key and only the fields set', async () => {
    const api = TestBed.inject(PlanChangesApi);
    const url = `${API}/internal/v1/organizations/org-1/plan-changes`;
    const flushed = {
      id: 'pc-2',
      fromPlan: 'max',
      toPlan: 'max',
      changedAt: '2026-10-26T15:00:00Z',
    };

    const extend = firstValueFrom(
      api.change(
        'org-1',
        { plan: null, period: { kind: 'extend', days: 30 }, note: ' Yape ' },
        'k-1',
      ),
    );
    let request = backend.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('k-1');
    expect(request.request.body).toEqual({ extendDays: 30, note: 'Yape' });
    request.flush(flushed);
    await extend;

    const until = firstValueFrom(
      api.change(
        'org-1',
        {
          plan: 'standard',
          period: { kind: 'until', activeUntil: new Date('2026-10-01T05:00:00Z') },
          note: 'Pago revertido',
        },
        'k-2',
      ),
    );
    request = backend.expectOne(url);
    expect(request.request.body).toEqual({
      plan: 'standard',
      activeUntil: '2026-10-01T05:00:00.000Z',
      note: 'Pago revertido',
    });
    request.flush(flushed);
    await until;

    const planOnly = firstValueFrom(
      api.change('org-1', { plan: 'max', period: { kind: 'keep' }, note: 'Mejora' }, 'k-3'),
    );
    request = backend.expectOne(url);
    expect(request.request.body).toEqual({ plan: 'max', note: 'Mejora' });
    request.flush(flushed);
    await planOnly;
  });

  it('A9: reads usage for a period, per establishment in its own days', async () => {
    const period = UsagePeriod.of(LocalDate.parse('2026-09-27'), LocalDate.parse('2026-10-26'));
    const call = firstValueFrom(TestBed.inject(OrganizationAccountsApi).usage('org-1', period));

    const request = backend.expectOne(
      (r) => r.url === `${API}/internal/v1/organizations/org-1/assistant-usage`,
    );
    expect(request.request.params.get('from')).toBe('2026-09-27');
    expect(request.request.params.get('to')).toBe('2026-10-26');
    request.flush({
      organizationId: 'org-1',
      from: '2026-09-27',
      to: '2026-10-26',
      totals: { turns: 3, inputTokens: 3000, cachedTokens: 1000, outputTokens: 300, toolCalls: 4 },
      establishments: [
        {
          establishmentId: 'est-1',
          establishmentName: 'Miraflores',
          timeZone: 'America/Lima',
          from: '2026-09-27',
          to: '2026-10-26',
          totals: {
            turns: 3,
            inputTokens: 3000,
            cachedTokens: 1000,
            outputTokens: 300,
            toolCalls: 4,
          },
          days: [{ date: '2026-10-25', totals: { turns: 3 } }],
        },
      ],
    });

    const usage = await call;
    expect(usage.totals.inputTokens).toBe(3000);
    expect(usage.establishments[0]).toMatchObject({ name: 'Miraflores', timeZone: 'America/Lima' });
    expect(usage.establishments[0].days[0].date.toString()).toBe('2026-10-25');
    expect(usage.establishments[0].days[0].totals.outputTokens).toBe(0);
    expect(usage.isEmpty).toBe(false);
  });
});
