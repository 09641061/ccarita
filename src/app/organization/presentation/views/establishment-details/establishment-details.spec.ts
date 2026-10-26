import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { MemberAction, MemberRole, canPerform } from '../../../domain/model/member-role';
import { ArchiveEstablishmentSheet } from '../archive-establishment-sheet/archive-establishment-sheet';
import { OpenEstablishmentSheet } from '../open-establishment-sheet/open-establishment-sheet';
import { EstablishmentDetails } from './establishment-details';

const MIRAFLORES = new Establishment('est-1', 'Miraflores', 'Av. Larco 345', 'America/Lima', null);

describe('EstablishmentDetails', () => {
  let describeEstablishment: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  async function render(role: MemberRole = 'owner', planActive = true) {
    describeEstablishment = vi.fn(async () => MIRAFLORES);
    open = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
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
            selected: signal(MIRAFLORES),
            id: signal('est-1'),
            describe: describeEstablishment,
          },
        },
        { provide: MatBottomSheet, useValue: { open } },
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

  it('opens the sheets to open another establishment and to archive this one', async () => {
    const { host } = await render();
    button(host, 'Abrir otro local').click();
    expect(open).toHaveBeenCalledWith(OpenEstablishmentSheet, expect.anything());
    button(host, 'Archivar este local').click();
    expect(open).toHaveBeenCalledWith(
      ArchiveEstablishmentSheet,
      expect.objectContaining({ data: MIRAFLORES }),
    );
  });

  it('O6: an inactive plan disables saving and opening, but not archiving', async () => {
    const { host } = await render('owner', false);
    expect(button(host, 'Guardar cambios').disabled).toBe(true);
    expect(button(host, 'Abrir otro local').disabled).toBe(true);
    expect(button(host, 'Archivar este local').disabled).toBe(false);
  });

  it('03 §5: is the owner’s', async () => {
    const { host } = await render('manager');
    expect(text(host)).toContain('no está disponible para tu rol');
    expect(host.querySelector('form')).toBeNull();
  });
});
