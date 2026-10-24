import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NAMELESS, ROSA } from '../../../../../testing/customer-fixtures';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CustomerDetailStore } from '../../../application/customer-detail.store';
import { CustomerListStore } from '../../../application/customer-list.store';
import { CustomerPage } from '../../../domain/model/customer-page';
import { CustomerList } from './customer-list';

describe('CustomerList', () => {
  let store: {
    query: ReturnType<typeof signal<string>>;
    results: ReturnType<typeof fakeResource<CustomerPage>>;
    search: ReturnType<typeof vi.fn>;
    next: ReturnType<typeof vi.fn>;
    previous: ReturnType<typeof vi.fn>;
  };

  async function render(page: CustomerPage | undefined) {
    store = {
      query: signal(''),
      results: fakeResource(page),
      search: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([
          { path: 'clientes', component: CustomerList },
          { path: '**', children: [] },
        ]),
        { provide: CustomerListStore, useValue: store },
        { provide: CustomerDetailStore, useValue: { openedId: signal('c-1') } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/clientes');
    await harness.fixture.whenStable();
    return { harness, host: harness.routeNativeElement as HTMLElement };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const button = (host: HTMLElement, label: string) =>
    host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it('lists customers, marking the one open and the ones without a name', async () => {
    const { host } = await render(new CustomerPage([ROSA, NAMELESS], 0, true));
    const rows = host.querySelectorAll<HTMLAnchorElement>('li a.row');
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('href')).toBe('/clientes/c-1');
    expect(rows[0].classList).toContain('selected');
    expect(rows[1].textContent).toContain('Sin nombre');
    expect(rows[1].textContent).toContain('+51912345678');
    expect(text(host)).toContain('1 – 2');
    expect(host.querySelector('a[href="/clientes/nuevo"]')).not.toBeNull();
  });

  it('pages without a total', async () => {
    const { host } = await render(new CustomerPage([ROSA], 2, true));
    expect(text(host)).toContain('41 – 41');
    button(host, 'Página siguiente').click();
    button(host, 'Página anterior').click();
    expect(store.next).toHaveBeenCalled();
    expect(store.previous).toHaveBeenCalled();
  });

  it('cannot go before the first page or past the last', async () => {
    const { host } = await render(new CustomerPage([ROSA], 0, false));
    expect(button(host, 'Página anterior').disabled).toBe(true);
    expect(button(host, 'Página siguiente').disabled).toBe(true);
  });

  it('searches as the text changes', async () => {
    const { host } = await render(new CustomerPage([], 0, false));
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = '987';
    input.dispatchEvent(new Event('input'));
    expect(store.search).toHaveBeenCalledWith('987');
  });

  it('says when there are no customers yet, or none match', async () => {
    const { harness, host } = await render(new CustomerPage([], 0, false));
    expect(text(host)).toContain('Aún no hay clientes');
    store.query.set('Zoila');
    await harness.fixture.whenStable();
    expect(text(host)).toContain('Sin resultados');
  });

  it('offers a retry when offline', async () => {
    const { harness, host } = await render(undefined);
    expect(host.querySelector('app-skeleton')).not.toBeNull();
    store.results.error.set(new ApiError(0, 'NETWORK_ERROR', 'x'));
    await harness.fixture.whenStable();
    host.querySelector<HTMLButtonElement>('app-state-view button')!.click();
    expect(store.results.reload).toHaveBeenCalled();
  });
});
