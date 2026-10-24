import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { Customer, CustomerPage, CustomerSearch } from '../../../../customers/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CustomerStep } from './customer-step';

const ROSA = new Customer('c-1', '+51987654321', 'Rosa Huamán');

describe('CustomerStep', () => {
  let search: {
    query: ReturnType<typeof signal<string>>;
    results: ReturnType<typeof fakeResource<CustomerPage>>;
    search: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
  };

  async function render(page: CustomerPage | undefined = new CustomerPage([ROSA], 0, true)) {
    search = {
      query: signal(''),
      results: fakeResource(page),
      search: vi.fn((q: string) => search.query.set(q)),
      register: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [provideSpanish(), { provide: CustomerSearch, useValue: search }],
    });
    const fixture = TestBed.createComponent(CustomerStep);
    const chosen = vi.fn();
    fixture.componentInstance.chosen.subscribe(chosen);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement, chosen };
  }

  const buttonWith = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent!.includes(label),
    )!;
  const input = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll('mat-form-field')]
      .find((f) => f.textContent!.includes(label))!
      .querySelector('input')!;
  const typeInto = (element: HTMLInputElement, value: string) => {
    element.value = value;
    element.dispatchEvent(new Event('input'));
  };

  it('searches as you type and picks a customer', async () => {
    const { fixture, host, chosen } = await render();
    typeInto(input(host, 'Buscar'), 'Ros');
    expect(search.search).toHaveBeenCalledWith('Ros');
    expect(host.textContent).toContain('Hay más clientes');

    buttonWith(host, 'Rosa Huamán').click();
    await fixture.whenStable();
    expect(chosen).toHaveBeenCalledWith(ROSA);
  });

  it('says when nothing matches, and offers retry offline', async () => {
    const { fixture, host } = await render(new CustomerPage([], 0, false));
    search.query.set('Zoila');
    await fixture.whenStable();
    expect(host.textContent).toContain('No encontramos clientes');

    search.results.error.set(new ApiError(0, 'NETWORK_ERROR', 'x'));
    await fixture.whenStable();
    buttonWith(host, 'Reintentar').click();
    expect(search.results.reload).toHaveBeenCalled();
  });

  it('registers with the typed phone, reusing the key on a retry (C3)', async () => {
    const { fixture, host, chosen } = await render();
    search.query.set('987 654 321');
    await fixture.whenStable();
    buttonWith(host, 'Registrar cliente nuevo').click();
    await fixture.whenStable();
    expect(input(host, 'Teléfono').value).toBe('987 654 321');

    search.register.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    buttonWith(host, 'Registrar').click();
    await settle();
    await fixture.whenStable();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('conexión');

    search.register.mockResolvedValueOnce(ROSA);
    buttonWith(host, 'Registrar').click();
    await settle();
    const [[command, first], [, retry]] = search.register.mock.calls;
    expect(command).toEqual({ phone: '987 654 321', name: null });
    expect(retry).toBe(first);
    expect(chosen).toHaveBeenCalledWith(ROSA);
  });

  it('finds the customer who already has the phone (C1)', async () => {
    const { fixture, host } = await render();
    buttonWith(host, 'Registrar cliente nuevo').click();
    await fixture.whenStable();
    typeInto(input(host, 'Teléfono'), '987 654 321');
    search.register.mockRejectedValueOnce(new ApiError(409, 'CUSTOMER_CONFLICT', 'x'));
    buttonWith(host, 'Registrar').click();
    await settle();
    await fixture.whenStable();
    expect(host.textContent).toContain('Ya hay un cliente con ese teléfono.');
    expect(search.search).toHaveBeenCalledWith('987654321');
  });

  it('asks for the phone', async () => {
    const { fixture, host } = await render();
    buttonWith(host, 'Registrar cliente nuevo').click();
    await fixture.whenStable();
    buttonWith(host, 'Registrar').click();
    await fixture.whenStable();
    expect(host.textContent).toContain('Escribe el teléfono.');
    expect(search.register).not.toHaveBeenCalled();
  });
});
