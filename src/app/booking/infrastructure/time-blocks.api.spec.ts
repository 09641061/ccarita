import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { timeBlockResource } from '../../../testing/booking-fixtures';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { idempotencyInterceptor } from '../../shared/infrastructure/http/idempotency';
import { TimeBlocksApi } from './time-blocks.api';

const API = 'http://api.test';

describe('TimeBlocksApi', () => {
  let backend: HttpTestingController;
  let api: TimeBlocksApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TimeBlocksApi);
  });

  afterEach(() => backend.verify());

  it('lists the blocks of a range, whole-establishment ones without a member', async () => {
    const result = firstValueFrom(
      api.listForEstablishment(
        'est-1',
        new Date('2026-10-19T05:00:00Z'),
        new Date('2026-10-26T05:00:00Z'),
      ),
    );
    const request = backend.expectOne(
      (r) => r.url === `${API}/api/v1/establishments/est-1/time-blocks`,
    );
    expect(request.request.params.get('from')).toBe('2026-10-19T05:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-10-26T05:00:00.000Z');
    request.flush([timeBlockResource('b-1', { staffMemberId: undefined, reason: undefined })]);

    const [block] = await result;
    expect(block.coversWholeEstablishment).toBe(true);
    expect(block.reason).toBeNull();
  });

  it('creates a block of a member with the idempotency key', async () => {
    const result = firstValueFrom(
      api.create(
        'est-1',
        {
          staffMemberId: 'm-1',
          start: new Date('2026-10-23T18:00:00Z'),
          end: new Date('2026-10-23T19:00:00Z'),
          reason: ' Almuerzo ',
        },
        'key-1',
      ),
    );
    const request = backend.expectOne(`${API}/api/v1/establishments/est-1/time-blocks`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    expect(request.request.body).toEqual({
      staffMemberId: 'm-1',
      start: '2026-10-23T18:00:00.000Z',
      end: '2026-10-23T19:00:00.000Z',
      reason: 'Almuerzo',
    });
    request.flush(timeBlockResource('b-1'));
    expect((await result).id).toBe('b-1');
  });

  it('leaves out the member and an empty reason to block the whole establishment', () => {
    void firstValueFrom(
      api.create(
        'est-1',
        {
          staffMemberId: null,
          start: new Date('2026-10-23T18:00:00Z'),
          end: new Date('2026-10-23T19:00:00Z'),
          reason: '  ',
        },
        'key-2',
      ),
    );
    const request = backend.expectOne(`${API}/api/v1/establishments/est-1/time-blocks`);
    expect(request.request.body).toEqual({
      start: '2026-10-23T18:00:00.000Z',
      end: '2026-10-23T19:00:00.000Z',
    });
    request.flush(timeBlockResource('b-2', { staffMemberId: undefined }));
  });

  it('deletes a block without an idempotency key', async () => {
    const result = firstValueFrom(api.delete('b-1'));
    const request = backend.expectOne(`${API}/api/v1/time-blocks/b-1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.has('Idempotency-Key')).toBe(false);
    request.flush(null, { status: 204, statusText: 'No Content' });
    await result;
  });
});
