import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../testing/settle';
import { CurrentEstablishment } from '../../organization/public-api';
import { API_BASE_URL } from '../../shared/infrastructure/http/api-base-url';
import { apiErrorInterceptor } from '../../shared/infrastructure/http/api-error.interceptor';
import { AssistantSettingsStore } from './assistant-settings.store';

const API = 'http://api.test';
const url = (id: string) => `${API}/api/v1/establishments/${id}/assistant`;
const settings = (id: string, enabled: boolean, businessInfo = '') => ({
  establishmentId: id,
  enabled,
  businessInfo,
});

describe('AssistantSettingsStore', () => {
  let backend: HttpTestingController;
  let store: AssistantSettingsStore;
  const establishmentId = signal<string | null>('est-1');

  beforeEach(() => {
    establishmentId.set('est-1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
        { provide: CurrentEstablishment, useValue: { id: establishmentId } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AssistantSettingsStore);
  });

  afterEach(() => backend.verify());

  async function flush(id: string, body: object) {
    TestBed.tick();
    backend.expectOne(url(id)).flush(body);
    await settle();
  }

  it('reloads with the establishment', async () => {
    await flush('est-1', settings('est-1', false));
    establishmentId.set('est-2');
    await flush('est-2', settings('est-2', true, 'Yape'));
    expect(store.settings.value()?.businessInfo).toBe('Yape');
  });

  it('A1: shows what pibble saved', async () => {
    await flush('est-1', settings('est-1', false));
    const saving = store.save('est-1', { enabled: true, businessInfo: '  Plin ' });
    backend.expectOne(url('est-1')).flush(settings('est-1', true, 'Plin'));
    await saving;
    expect(store.settings.value()).toEqual(settings('est-1', true, 'Plin'));
  });

  it('reloads after someone else saved the first settings meanwhile', async () => {
    await flush('est-1', settings('est-1', false));
    const saving = store.save('est-1', { enabled: true, businessInfo: '' });
    backend
      .expectOne(url('est-1'))
      .flush(
        { code: 'ASSISTANT_SETTINGS_CONFLICT', message: 'reload' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(saving).rejects.toMatchObject({ code: 'ASSISTANT_SETTINGS_CONFLICT' });
    await flush('est-1', settings('est-1', true, 'Del otro'));
    expect(store.settings.value()?.businessInfo).toBe('Del otro');
  });

  it('O6: surfaces PLAN_INACTIVE without reloading', async () => {
    await flush('est-1', settings('est-1', false));
    const saving = store.save('est-1', { enabled: true, businessInfo: '' });
    backend
      .expectOne(url('est-1'))
      .flush({ code: 'PLAN_INACTIVE', message: 'x' }, { status: 402, statusText: 'Payment' });
    await expect(saving).rejects.toMatchObject({ code: 'PLAN_INACTIVE' });
    TestBed.tick();
    backend.expectNone(url('est-1'));
  });
});
