import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { Money } from '../../../../shared/domain/model/money';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { EstablishmentTeam } from '../../../application/establishment-team.store';
import { ServiceCatalog } from '../../../application/service-catalog.store';
import { Member } from '../../../domain/model/member';
import { MemberAction, MemberRole, canPerform } from '../../../domain/model/member-role';
import { Service } from '../../../domain/model/service';
import { ServiceList } from './service-list';

const CUT = new Service('s-1', 'est-1', 'Corte clásico', 45, new Money(3500, 'PEN'), true, ['m-1']);
const DYE = new Service('s-2', 'est-1', 'Tinte', 90, new Money(9000, 'PEN'), false, []);
const KEVIN = new Member('m-1', 'kevin@example.com', 'Kevin', 'staff', true, 'active', ['est-1']);
const LUIS = new Member('m-2', 'luis@example.com', 'Luis', 'owner', true, 'active', []);

describe('ServiceList', () => {
  let services: ReturnType<typeof fakeResource<Service[]>>;
  let catalog: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    setActive: ReturnType<typeof vi.fn>;
  };

  async function render(
    list: Service[] = [CUT, DYE],
    options: { role?: MemberRole; planActive?: boolean } = {},
  ) {
    services = fakeResource(list);
    catalog = {
      create: vi.fn(async () => CUT),
      update: vi.fn(async () => CUT),
      setActive: vi.fn(async () => CUT),
    };
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: EstablishmentTeam, useValue: { services, bookable: signal([KEVIN, LUIS]) } },
        { provide: ServiceCatalog, useValue: catalog },
        {
          provide: CurrentOrganization,
          useValue: {
            can: (action: MemberAction) => canPerform(options.role ?? 'manager', action),
            planActive: signal(options.planActive ?? true),
          },
        },
        { provide: CurrentEstablishment, useValue: { id: signal('est-1') } },
      ],
    });
    const fixture = TestBed.createComponent(ServiceList);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const stable = async () => {
      await settle();
      await fixture.whenStable();
    };
    return { host, stable };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const button = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      (b.textContent! + (b.getAttribute('aria-label') ?? '')).includes(label),
    )!;
  const fill = (host: HTMLElement, index: number, value: string) => {
    const field = host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="checkbox"]), textarea',
    )[index];
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };
  const submit = async (host: HTMLElement, stable: () => Promise<void>) => {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await stable();
  };

  it('O14: lists active and deactivated services with duration, price and performers', async () => {
    const { host } = await render();
    expect(text(host)).toContain('Activos');
    expect(text(host)).toContain('Corte clásico');
    expect(text(host)).toContain('45 min · S/ 35.00 · 1 personas');
    expect(text(host)).toContain('Desactivados');
    expect(text(host)).toContain('Nadie lo hace aún');
  });

  it('O14: deactivates and activates a service', async () => {
    const { host, stable } = await render();
    button(host, 'Desactivar').click();
    await stable();
    expect(catalog.setActive).toHaveBeenCalledWith('s-1', false);
    button(host, 'Activar').click();
    await stable();
    expect(catalog.setActive).toHaveBeenCalledWith('s-2', true);
  });

  it('O15: creates a service in céntimos with its performers, retrying with the same key', async () => {
    const { host, stable } = await render();
    button(host, 'Nuevo servicio').click();
    await stable();
    fill(host, 0, 'Barba');
    fill(host, 1, '30');
    fill(host, 2, '25,50');
    host.querySelector<HTMLInputElement>('mat-checkbox input')!.click();
    await stable();
    catalog.create.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    await submit(host, stable);
    await submit(host, stable);

    expect(catalog.create.mock.calls[0][0]).toBe('est-1');
    expect(catalog.create.mock.calls[0][1]).toEqual({
      name: 'Barba',
      durationMinutes: 30,
      priceCents: 2550,
      instructions: '',
      performerIds: ['m-1'],
    });
    expect(catalog.create.mock.calls[1][2]).toBe(catalog.create.mock.calls[0][2]);
    expect(text(host)).toContain('Corte clásico');
  });

  it('renews the key when the service changes after a failure', async () => {
    const { host, stable } = await render();
    button(host, 'Nuevo servicio').click();
    await stable();
    fill(host, 0, 'Barba');
    fill(host, 1, '30');
    fill(host, 2, '25');
    catalog.create.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    await submit(host, stable);
    fill(host, 2, '28');
    await submit(host, stable);
    expect(catalog.create.mock.calls[1][2]).not.toBe(catalog.create.mock.calls[0][2]);
  });

  it('refuses a price that is not soles', async () => {
    const { host, stable } = await render();
    button(host, 'Nuevo servicio').click();
    await stable();
    fill(host, 0, 'Barba');
    fill(host, 1, '30');
    fill(host, 2, 'treinta');
    await submit(host, stable);
    expect(catalog.create).not.toHaveBeenCalled();
    expect(text(host)).toContain('Escribe un precio en soles');
  });

  it('edits a service with a PUT, showing pibble’s refusal', async () => {
    const { host, stable } = await render();
    button(host, 'Editar Corte clásico').click();
    await stable();
    expect(host.querySelector<HTMLInputElement>('input')!.value).toBe('Corte clásico');
    catalog.update.mockRejectedValueOnce(new ApiError(422, 'PERFORMER_NOT_ELIGIBLE', ''));
    await submit(host, stable);
    expect(text(host)).toContain('Esta persona no puede realizar ese servicio aquí.');
    await submit(host, stable);
    expect(catalog.update).toHaveBeenLastCalledWith(
      's-1',
      expect.objectContaining({ priceCents: 3500, performerIds: ['m-1'] }),
    );
    expect(text(host)).toContain('Activos');
  });

  it('offers adding the first service', async () => {
    const { host } = await render([]);
    expect(text(host)).toContain('Aún no hay servicios');
  });

  it('O6: disables every change while the plan is inactive', async () => {
    const { host } = await render([CUT], { planActive: false });
    expect(button(host, 'Nuevo servicio').disabled).toBe(true);
    expect(button(host, 'Desactivar').disabled).toBe(true);
    expect(button(host, 'Editar Corte clásico').disabled).toBe(true);
  });

  it('03 §5: staff cannot change services', async () => {
    const { host } = await render([CUT], { role: 'staff' });
    expect(text(host)).toContain('no está disponible para tu rol');
  });
});
