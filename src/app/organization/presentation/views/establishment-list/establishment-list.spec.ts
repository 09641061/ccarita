import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { MemberAction, MemberRole, canPerform } from '../../../domain/model/member-role';
import { ArchiveEstablishmentDialog } from '../archive-establishment-dialog/archive-establishment-dialog';
import { OpenEstablishmentDialog } from '../open-establishment-dialog/open-establishment-dialog';
import { EstablishmentList } from './establishment-list';

const MIRAFLORES = new Establishment('est-1', 'Miraflores', 'Av. Larco 345', 'America/Lima', null);
const SURCO = new Establishment('est-2', 'Surco', '', 'America/Lima', null);

describe('EstablishmentList', () => {
  let open: ReturnType<typeof vi.fn>;
  let describeEstablishment: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;

  async function render(role: MemberRole = 'owner', planActive = true) {
    open = vi.fn();
    select = vi.fn();
    describeEstablishment = vi.fn(async () => SURCO);
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
            id: signal('est-1'),
            establishments: signal([MIRAFLORES, SURCO]),
            list: { error: signal(undefined), reload: vi.fn() },
            describe: describeEstablishment,
            select,
          },
        },
        { provide: MatDialog, useValue: { open } },
      ],
    });
    const fixture = TestBed.createComponent(EstablishmentList);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      [...host.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent!.includes(label) || b.getAttribute('aria-label') === label,
      )!;
    return { fixture, host, button };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');

  it('O4: lists the establishments, marking the selected one, opens one in a dialog and archives them', async () => {
    const { host, button } = await render();
    expect(text(host)).toContain('Miraflores Seleccionado');
    expect(text(host)).toContain('Surco');

    button('Abrir local').click();
    expect(open).toHaveBeenCalledWith(OpenEstablishmentDialog, expect.anything());
    button('Archivar Surco').click();
    expect(open).toHaveBeenCalledWith(
      ArchiveEstablishmentDialog,
      expect.objectContaining({ data: SURCO }),
    );
  });

  it('O7: edits an establishment in its row, without selecting it', async () => {
    const { fixture, host, button } = await render();
    button('Editar datos de Surco').click();
    await fixture.whenStable();
    const form = host.querySelector('li.editing app-establishment-details form');
    expect(form).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>('li.editing input')!.value).toBe('Surco');

    form!.dispatchEvent(new Event('submit'));
    await settle();
    await fixture.whenStable();
    expect(describeEstablishment).toHaveBeenCalledWith('est-2', expect.anything());
    expect(select).not.toHaveBeenCalled();
    expect(host.querySelector('form')).toBeNull();
    expect(text(host)).toContain('Cambios guardados.');
  });

  it('O6: an inactive plan disables opening, but not archiving', async () => {
    const { button } = await render('owner', false);
    expect(button('Abrir local').disabled).toBe(true);
    expect(button('Archivar Surco').disabled).toBe(false);
  });

  it('03 §5: is the owner’s', async () => {
    const { host } = await render('manager');
    expect(text(host)).toContain('no está disponible para tu rol');
  });
});
