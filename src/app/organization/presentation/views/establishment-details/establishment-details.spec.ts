import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { MemberAction, MemberRole, canPerform } from '../../../domain/model/member-role';
import { EstablishmentDetails } from './establishment-details';

const MIRAFLORES = new Establishment('est-1', 'Miraflores', 'Av. Larco 345', 'America/Lima', null);

describe('EstablishmentDetails', () => {
  let describeEstablishment: ReturnType<typeof vi.fn>;

  const selected = signal(MIRAFLORES);

  async function render(role: MemberRole = 'owner', planActive = true) {
    selected.set(MIRAFLORES);
    // pibble answers and the list reloads with a new object for the same establishment.
    describeEstablishment = vi.fn(async () => {
      selected.set(
        new Establishment('est-1', 'Sede Miraflores', 'Av. Larco 345', 'America/Lima', null),
      );
      return selected();
    });
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([]),
        {
          provide: CurrentOrganization,
          useValue: {
            can: (action: MemberAction) => canPerform(role, action),
            planActive: signal(planActive),
          },
        },
        {
          provide: CurrentEstablishment,
          useValue: {
            selected,
            id: signal('est-1'),
            describe: describeEstablishment,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(EstablishmentDetails);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');
  const button = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent!.includes(label),
    )!;

  it('O7: fills the establishment and saves it with a PUT', async () => {
    const { fixture, host } = await render();
    const name = host.querySelector<HTMLInputElement>('input')!;
    expect(name.value).toBe('Miraflores');
    name.value = 'Sede Miraflores';
    name.dispatchEvent(new Event('input'));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    await fixture.whenStable();

    expect(describeEstablishment).toHaveBeenCalledWith('est-1', {
      name: 'Sede Miraflores',
      address: 'Av. Larco 345',
      timeZone: 'America/Lima',
    });
    expect(text(host)).toContain('Cambios guardados.');
  });

  it('shows why saving failed', async () => {
    const { fixture, host } = await render();
    describeEstablishment.mockRejectedValue(new ApiError(402, 'PLAN_INACTIVE', ''));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    await fixture.whenStable();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('sends opening and archiving establishments to Organización', async () => {
    const { host } = await render();
    expect(host.querySelector('a[href="/organizacion"]')?.textContent).toContain(
      'Ir a Organización',
    );
  });

  it('O6: an inactive plan disables saving', async () => {
    const { host } = await render('owner', false);
    expect(button(host, 'Guardar cambios').disabled).toBe(true);
  });

  it('03 §5: is the owner’s', async () => {
    const { host } = await render('manager');
    expect(text(host)).toContain('no está disponible para tu rol');
    expect(host.querySelector('form')).toBeNull();
  });
});
