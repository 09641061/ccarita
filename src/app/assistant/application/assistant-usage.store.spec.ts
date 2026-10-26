import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { CurrentEstablishment } from '../../organization/public-api';
import { LocalDate } from '../../shared/domain/model/local-date';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { UsagePeriod } from '../../shared/domain/model/usage-period';
import { AssistantUsageStore } from './assistant-usage.store';

const API = 'http://api.test';
const USAGE = `${API}/api/v1/establishments/est-1/assistant/usage`;
const usage = (from: string, to: string) => ({
  timeZone: 'America/Lima',
  from,
  to,
  totals: { turns: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, toolCalls: 0 },
  days: [],
});

describe('AssistantUsageStore', () => {
  let backend: HttpTestingController;
  let store: AssistantUsageStore;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-27T03:00:00Z') });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        {
          provide: CurrentEstablishment,
          useValue: { id: signal('est-1'), timeZone: signal('America/Lima') },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AssistantUsageStore);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  it('A9: opens with the last 7 days of the establishment', async () => {
    TestBed.tick();
    const request = backend.expectOne((r) => r.url === USAGE);
    expect([request.request.params.get('from'), request.request.params.get('to')]).toEqual([
      '2026-10-20',
      '2026-10-26',
    ]);
    request.flush(usage('2026-10-20', '2026-10-26'));
    await settle();
    expect(store.usage.value()?.isEmpty).toBe(true);
  });

  it('reloads when another period is chosen, not when the same one is', async () => {
    TestBed.tick();
    backend.expectOne((r) => r.url === USAGE).flush(usage('2026-10-20', '2026-10-26'));
    await settle();
    store.choose(UsagePeriod.of(LocalDate.parse('2026-10-20'), LocalDate.parse('2026-10-26')));
    TestBed.tick();
    backend.expectNone((r) => r.url === USAGE);
    store.choose(UsagePeriod.of(LocalDate.parse('2026-10-01'), LocalDate.parse('2026-10-31')));
    TestBed.tick();
    const request = backend.expectOne((r) => r.url === USAGE);
    expect(request.request.params.get('from')).toBe('2026-10-01');
    request.flush(usage('2026-10-01', '2026-10-31'));
    await settle();
  });
});
