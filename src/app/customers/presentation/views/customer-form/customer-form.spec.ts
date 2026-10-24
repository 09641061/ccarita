import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NAMELESS, ROSA } from '../../../../../testing/customer-fixtures';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CustomerDetailStore } from '../../../application/customer-detail.store';
import { CustomerProfile } from '../../../domain/model/customer-profile';
import { CustomerForm } from './customer-form';

describe('CustomerForm', () => {
  let store: {
    profile: ReturnType<typeof fakeResource<CustomerProfile>>;
    open: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  async function render(url: string, profile?: CustomerProfile) {
    store = {
      profile: fakeResource(profile),
      open: vi.fn(),
      register: vi.fn(async () => NAMELESS),
      update: vi.fn(async () => ROSA),
    };
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter(
          [
            { path: 'clientes/nuevo', component: CustomerForm },
            { path: 'clientes/:customerId/editar', component: CustomerForm },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        { provide: CustomerDetailStore, useValue: store },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    const host = harness.routeNativeElement as HTMLElement;
    const stable = () => harness.fixture.whenStable();
    return { harness, host, stable };
  }

  const fill = (host: HTMLElement, selector: string, value: string) => {
    const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };
  const submit = async (host: HTMLElement, stable: () => Promise<void>) => {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    await stable();
  };
  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const numberField = 'fieldset input';

  describe('registering', () => {
    it('needs the phone', async () => {
      const { host, stable } = await render('/clientes/nuevo');
      await submit(host, stable);
      expect(store.register).not.toHaveBeenCalled();
      expect(text(host)).toContain('Escribe el teléfono.');
    });

    it('C4: asks for the document type when only the number was typed', async () => {
      const { host, stable } = await render('/clientes/nuevo');
      fill(host, 'input[type="tel"]', '912 345 678');
      fill(host, numberField, '45678912');
      await submit(host, stable);
      expect(store.register).not.toHaveBeenCalled();
      expect(text(host)).toContain('Elige el tipo de documento.');
    });

    it('registers and opens the customer', async () => {
      const { host, stable } = await render('/clientes/nuevo');
      fill(host, 'input[type="tel"]', '912 345 678');
      fill(host, 'textarea', 'Viene los sábados');
      await submit(host, stable);
      expect(store.register).toHaveBeenCalledWith(
        {
          phone: '912 345 678',
          name: null,
          documentType: null,
          documentNumber: '',
          notes: 'Viene los sábados',
        },
        expect.any(String),
      );
      expect(TestBed.inject(Router).url).toBe('/clientes/c-2');
    });

    it('retries a lost answer with the same key, and a changed form with a new one', async () => {
      const { host, stable } = await render('/clientes/nuevo');
      store.register.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
      store.register.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
      fill(host, 'input[type="tel"]', '912345678');
      await submit(host, stable);
      expect(text(host)).toContain('Sin conexión');
      await submit(host, stable);
      fill(host, 'input[type="tel"]', '912345679');
      await submit(host, stable);

      const [first, retry, changed] = store.register.mock.calls.map((call) => call[1]);
      expect(retry).toBe(first);
      expect(changed).not.toBe(first);
    });

    it('explains a phone that is taken (C1)', async () => {
      const { host, stable } = await render('/clientes/nuevo');
      store.register.mockRejectedValueOnce(new ApiError(409, 'CUSTOMER_CONFLICT', 'x'));
      fill(host, 'input[type="tel"]', '987654321');
      await submit(host, stable);
      expect(host.querySelector('[role="alert"]')!.textContent).toContain(
        'Ya hay un cliente con ese teléfono.',
      );
    });
  });

  describe('editing', () => {
    it('fills the form and keeps the phone fixed (C1)', async () => {
      const { host } = await render('/clientes/c-1/editar', ROSA);
      expect(store.open).toHaveBeenCalledWith('c-1');
      expect(host.querySelector('input[type="tel"]')).toBeNull();
      expect(text(host)).toContain('+51987654321');
      expect(text(host)).toContain('El teléfono no se puede cambiar.');
      expect(host.querySelector<HTMLInputElement>(numberField)!.value).toBe('45678912');
      expect(host.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe(
        'Prefiere atenderse con Luis.',
      );
    });

    it('sends the whole form, with cleared fields empty (C4)', async () => {
      const { host, stable } = await render('/clientes/c-1/editar', ROSA);
      fill(host, 'textarea', '');
      await submit(host, stable);
      expect(store.update).toHaveBeenCalledWith('c-1', {
        name: 'Rosa Huamán',
        documentType: 'dni',
        documentNumber: '45678912',
        notes: '',
      });
      expect(TestBed.inject(Router).url).toBe('/clientes/c-1');
    });

    it('C4: asks for the number when it was cleared but the type kept', async () => {
      const { host, stable } = await render('/clientes/c-1/editar', ROSA);
      fill(host, numberField, ' ');
      await submit(host, stable);
      expect(store.update).not.toHaveBeenCalled();
      expect(text(host)).toContain('Escribe el número de documento.');
    });

    it('hints at the format when pibble refuses the document', async () => {
      const { host, stable } = await render('/clientes/c-1/editar', ROSA);
      store.update.mockRejectedValueOnce(new ApiError(400, 'VALIDATION_ERROR', 'x'));
      fill(host, numberField, '123');
      await submit(host, stable);
      expect(host.querySelector('[role="alert"]')!.textContent).toContain('el DNI tiene 8 dígitos');
    });

    it('explains a deleted customer', async () => {
      const { harness, host } = await render('/clientes/c-1/editar');
      store.profile.error.set(new ApiError(404, 'CUSTOMER_NOT_FOUND', 'x'));
      await harness.fixture.whenStable();
      expect(text(host)).toContain('Este cliente no existe');
    });
  });
});
