import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LocalDate } from '../../shared/domain/model/local-date';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { UsagePeriod } from '../domain/model/usage-period';
import { AssistantUsageApi } from './assistant-usage.api';
import { AssistantApi } from './assistant.api';

const API = 'http://api.test';
const ASSISTANT = `${API}/api/v1/establishments/est-1/assistant`;

describe('AssistantApi and AssistantUsageApi', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('A1: reads the settings, with no business info as empty text', async () => {
    const read = firstValueFrom(TestBed.inject(AssistantApi).settings('est-1'));
    backend.expectOne(ASSISTANT).flush({ establishmentId: 'est-1', enabled: false });
    expect(await read).toEqual({ establishmentId: 'est-1', enabled: false, businessInfo: '' });
  });

  it('A1: puts both fields, without an idempotency key', async () => {
    const saved = firstValueFrom(
      TestBed.inject(AssistantApi).configure('est-1', { enabled: true, businessInfo: 'Yape' }),
    );
    const request = backend.expectOne(ASSISTANT);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ enabled: true, businessInfo: 'Yape' });
    expect(request.request.headers.has('Idempotency-Key')).toBe(false);
    request.flush({ establishmentId: 'est-1', enabled: true, businessInfo: 'Yape' });
    expect((await saved).enabled).toBe(true);
  });

  it('A9: asks for usage by local days and maps the days and totals', async () => {
    const period = UsagePeriod.of(LocalDate.parse('2026-10-20'), LocalDate.parse('2026-10-26'));
    const read = firstValueFrom(TestBed.inject(AssistantUsageApi).forPeriod('est-1', period));
    const request = backend.expectOne((r) => r.url === `${ASSISTANT}/usage`);
    expect(request.request.params.get('from')).toBe('2026-10-20');
    expect(request.request.params.get('to')).toBe('2026-10-26');
    const totals = {
      turns: 3,
      inputTokens: 3000,
      cachedTokens: 1200,
      outputTokens: 300,
      toolCalls: 4,
    };
    request.flush({
      establishmentId: 'est-1',
      establishmentName: 'Miraflores',
      timeZone: 'America/Lima',
      from: '2026-10-20',
      to: '2026-10-26',
      totals,
      days: [{ date: '2026-10-22', totals }],
    });
    const usage = await read;
    expect(usage.period.equals(period)).toBe(true);
    expect(usage.timeZone).toBe('America/Lima');
    expect(usage.totals).toEqual(totals);
    expect(usage.days.map((d) => [d.date.toString(), d.totals.turns])).toEqual([['2026-10-22', 3]]);
  });
});
