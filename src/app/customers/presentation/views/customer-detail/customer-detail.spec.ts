import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { NAMELESS, ROSA } from '../../../../../testing/customer-fixtures';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CUSTOMER_ACCESS } from '../../../application/customer-access';
import { CustomerDetailStore } from '../../../application/customer-detail.store';
import { CustomerProfile } from '../../../domain/model/customer-profile';
import { CustomerDetail } from './customer-detail';

describe('CustomerDetail', () => {
  const canDelete = signal(true);
  const canBook = signal(true);
  const chat = signal<string | null>(null);
  const chatOf = (customerId: string) => (customerId === 'c-1' ? chat() : null);
  let store: {
    profile: ReturnType<typeof fakeResource<CustomerProfile>>;
    open: ReturnType<typeof vi.fn>;
  };
  let open: ReturnType<typeof vi.fn>;

  async function render(profile: CustomerProfile | undefined = ROSA) {
    store = { profile: fakeResource(profile), open: vi.fn() };
    open = vi.fn(() => ({ afterClosed: () => of(true) }));
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter(
          [
            { path: 'clientes/:customerId', component: CustomerDetail },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        { provide: CustomerDetailStore, useValue: store },
        { provide: CUSTOMER_ACCESS, useValue: { canDelete, canBook, chatOf } },
        { provide: MatDialog, useValue: { open } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/clientes/${profile?.id ?? 'c-1'}`);
    await harness.fixture.whenStable();
    return { harness, host: harness.routeNativeElement as HTMLElement };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');

  beforeEach(() => {
    canDelete.set(true);
    canBook.set(true);
    chat.set(null);
  });

  it('W3: opens the customer’s chat when the inbox has it', async () => {
    const { harness, host } = await render();
    expect(host.querySelector('a.chat')).toBeNull();
    chat.set('conv-7');
    await harness.fixture.whenStable();
    expect(host.querySelector('a.chat')!.getAttribute('href')).toBe('/mensajes/conv-7');
    expect(host.querySelector('a.chat')!.textContent).toContain('Ver chat');
  });

  it('shows the phone, WhatsApp name, document and notes (C1, C2, C4)', async () => {
    const { host } = await render();
    expect(store.open).toHaveBeenCalledWith('c-1');
    expect(host.querySelector('h1')!.textContent).toContain('Rosa Huamán');
    expect(text(host)).toContain('Perfil de WhatsApp: “Rosita H.”');
    expect(host.querySelector<HTMLAnchorElement>('a.phone')!.getAttribute('href')).toBe(
      'tel:+51987654321',
    );
    expect(text(host)).toContain('DNI 45678912');
    expect(text(host)).toContain('Prefiere atenderse con Luis.');
    const book = host.querySelector<HTMLAnchorElement>('.actions a')!;
    expect(book.getAttribute('href')).toBe('/agenda/reservar?cliente=c-1');
  });

  it('marks what staff did not type', async () => {
    const { host } = await render(NAMELESS);
    expect(text(host)).not.toContain('Perfil de WhatsApp');
    expect(host.querySelectorAll('dd .muted')).toHaveLength(2);
  });

  it('lets owners and managers delete, then leaves (C3, C5)', async () => {
    const { harness, host } = await render();
    const router = TestBed.inject(Router);
    host.querySelector<HTMLButtonElement>('button.delete')!.click();
    await harness.fixture.whenStable();
    expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: ROSA }));
    expect(router.url).toBe('/clientes');
  });

  it('hides deleting from staff', async () => {
    canDelete.set(false);
    const { host } = await render();
    expect(host.querySelector('button.delete')).toBeNull();
    expect(host.querySelector('a[aria-label="Editar cliente"]')).not.toBeNull();
  });

  it('keeps everything but booking on an inactive plan (C3, O6)', async () => {
    canBook.set(false);
    const { host } = await render();
    expect(host.querySelector('.actions a')!.getAttribute('aria-disabled')).toBe('true');
    expect(text(host)).toContain('Con el plan vencido no se puede reservar.');
    expect(host.querySelector('button.delete')).not.toBeNull();
  });

  it('explains a deleted customer', async () => {
    const { harness, host } = await render(undefined);
    store.profile.error.set(new ApiError(404, 'CUSTOMER_NOT_FOUND', 'x'));
    await harness.fixture.whenStable();
    expect(text(host)).toContain('Este cliente no existe');
  });

  it('offers a retry when offline', async () => {
    const { harness, host } = await render(undefined);
    store.profile.error.set(new ApiError(0, 'NETWORK_ERROR', 'x'));
    await harness.fixture.whenStable();
    host.querySelector<HTMLButtonElement>('app-state-view button')!.click();
    expect(store.profile.reload).toHaveBeenCalled();
  });
});
