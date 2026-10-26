import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { SessionStore } from '../../iam/public-api';
import { LocalDate } from '../../shared/domain/model/local-date';
import { UsagePeriod } from '../../shared/domain/model/usage-period';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { OperatorStore } from './operator.store';
import { OrganizationAccountStore } from './organization-account.store';
import { OrganizationAccountsStore } from './organization-accounts.store';

const API = 'http://api.test';
const ORGANIZATIONS = `${API}/internal/v1/organizations`;
const account = (id: string, name: string, ownerEmail: string) => ({
  id,
  name,
  plan: 'max',
  planActiveUntil: '2026-11-06T05:00:00Z',
  planActive: true,
  ownerEmail,
  activeEstablishments: 1,
});
const denied = { status: 403, statusText: 'Forbidden' };

describe('platform stores', () => {
  let backend: HttpTestingController;
  const user = signal<{ id: string } | null>({ id: 'u-ops' });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-26T15:00:00Z') });
    user.set({ id: 'u-ops' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: SessionStore, useValue: { user } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  describe('OperatorStore', () => {
    it('offers the area to operators only, asking once per user', async () => {
      const store = TestBed.inject(OperatorStore);
      TestBed.tick();
      backend.expectOne(`${API}/internal/v1/operator`).flush({ id: 'u-ops' });
      await settle();
      expect(store.isOperator()).toBe(true);

      user.set({ id: 'u-owner' });
      TestBed.tick();
      backend.expectOne(`${API}/internal/v1/operator`).flush({ code: 'ACCESS_DENIED' }, denied);
      await settle();
      expect(store.isOperator()).toBe(false);
      expect(store.check.error()).toBeUndefined();
    });

    it('verifies on each entry: false on 403, throws otherwise', async () => {
      const store = TestBed.inject(OperatorStore);
      TestBed.tick();
      backend.expectOne(`${API}/internal/v1/operator`).flush({});

      const yes = store.verify();
      backend.expectOne(`${API}/internal/v1/operator`).flush({});
      expect(await yes).toBe(true);

      const no = store.verify();
      backend.expectOne(`${API}/internal/v1/operator`).flush({ code: 'ACCESS_DENIED' }, denied);
      expect(await no).toBe(false);

      const down = store.verify();
      backend
        .expectOne(`${API}/internal/v1/operator`)
        .error(new ProgressEvent('error'), { status: 0 });
      await expect(down).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });
  });

  describe('OrganizationAccountsStore', () => {
    it('lists and searches by name or owner email', async () => {
      const store = TestBed.inject(OrganizationAccountsStore);
      TestBed.tick();
      backend
        .expectOne(ORGANIZATIONS)
        .flush([
          account('org-1', 'Barbería Don Lucho', 'luis@donlucho.pe'),
          account('org-2', 'Spa Lima', 'ana@gmail.com'),
        ]);
      await settle();

      expect(store.visible().map((a) => a.id)).toEqual(['org-1', 'org-2']);
      store.query.set('barberia');
      expect(store.visible().map((a) => a.id)).toEqual(['org-1']);
      store.query.set('ANA@');
      expect(store.visible().map((a) => a.id)).toEqual(['org-2']);
      expect(store.find('org-2')?.name).toBe('Spa Lima');
      expect(store.find('org-9')).toBeNull();
    });
  });

  describe('OrganizationAccountStore', () => {
    async function open() {
      const store = TestBed.inject(OrganizationAccountStore);
      store.open('org-1');
      TestBed.tick();
      backend.expectOne(ORGANIZATIONS).flush([account('org-1', 'Barbería', 'luis@donlucho.pe')]);
      backend.expectOne(`${ORGANIZATIONS}/org-1/plan-changes`).flush([]);
      const usage = backend.expectOne((r) => r.url === `${ORGANIZATIONS}/org-1/assistant-usage`);
      await settle();
      return { store, usage };
    }

    it('A9: reads usage for the last 30 days in Lima, then the chosen period', async () => {
      const { store, usage } = await open();
      expect(usage.request.params.get('from')).toBe('2026-09-27');
      expect(usage.request.params.get('to')).toBe('2026-10-26');
      usage.flush({ from: '2026-09-27', to: '2026-10-26', totals: {}, establishments: [] });
      await settle();
      expect(store.account()?.name).toBe('Barbería');
      expect(store.usage.value()?.isEmpty).toBe(true);

      store.choose(UsagePeriod.of(LocalDate.parse('2026-10-01'), LocalDate.parse('2026-10-10')));
      TestBed.tick();
      const next = backend.expectOne((r) => r.url === `${ORGANIZATIONS}/org-1/assistant-usage`);
      expect(next.request.params.get('from')).toBe('2026-10-01');
      next.flush({ from: '2026-10-01', to: '2026-10-10', totals: {}, establishments: [] });
    });

    it('O5: records a change with its key, then reloads the list and the history', async () => {
      const { store, usage } = await open();
      usage.flush({ from: '2026-09-27', to: '2026-10-26', totals: {}, establishments: [] });

      const done = store.changePlan(
        { plan: null, period: { kind: 'extend', days: 30 }, note: 'Yape' },
        'k-1',
      );
      const post = backend.expectOne(`${ORGANIZATIONS}/org-1/plan-changes`);
      expect(post.request.headers.get('Idempotency-Key')).toBe('k-1');
      post.flush(
        { id: 'pc-1', fromPlan: 'max', toPlan: 'max', changedAt: '2026-10-26T15:00:00Z' },
        { status: 201, statusText: 'Created' },
      );
      expect((await done).id).toBe('pc-1');

      TestBed.tick();
      backend.expectOne(ORGANIZATIONS).flush([account('org-1', 'Barbería', 'luis@donlucho.pe')]);
      backend.expectOne(`${ORGANIZATIONS}/org-1/plan-changes`).flush([]);
      await settle();
    });
  });
});
