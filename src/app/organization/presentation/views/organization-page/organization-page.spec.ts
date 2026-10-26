import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Router, provideRouter } from '@angular/router';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { JoinedOrganization } from '../../../domain/model/joined-organization';
import { MemberAction, MemberRole, canPerform } from '../../../domain/model/member-role';
import { Organization } from '../../../domain/model/organization';
import { ArchiveEstablishmentSheet } from '../archive-establishment-sheet/archive-establishment-sheet';
import { OpenEstablishmentSheet } from '../open-establishment-sheet/open-establishment-sheet';
import { OrganizationPage } from './organization-page';

const UNTIL = new Date('2026-11-06T05:00:00Z');
const MIRAFLORES = new Establishment('est-1', 'Miraflores', 'Av. Larco 345', 'America/Lima', null);
const SURCO = new Establishment('est-2', 'Surco', '', 'America/Lima', null);

describe('OrganizationPage', () => {
  let rename: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  const selected = signal(
    new JoinedOrganization('org-1', 'Barbería Don Lucho', UNTIL, 'm-1', 'owner'),
  );

  async function render(role: MemberRole = 'owner', planActive = true) {
    selected.set(new JoinedOrganization('org-1', 'Barbería Don Lucho', UNTIL, 'm-1', 'owner'));
    // pibble answers and the memberships reload with a new object for the same organization.
    rename = vi.fn(async (name: string) => {
      selected.set(new JoinedOrganization('org-1', name, UNTIL, 'm-1', 'owner'));
    });
    open = vi.fn();
    select = vi.fn();
    const details = new Organization('org-1', 'Barbería Don Lucho', 'max', UNTIL);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([{ path: 'ajustes/datos', children: [] }]),
        {
          provide: CurrentOrganization,
          useValue: {
            can: (action: MemberAction) => canPerform(role, action),
            selected,
            planActive: signal(planActive),
            planActiveUntil: signal(UNTIL),
            details: { hasValue: () => true, value: () => details },
            rename,
          },
        },
        {
          provide: CurrentEstablishment,
          useValue: {
            timeZone: signal('America/Lima'),
            establishments: signal([MIRAFLORES, SURCO]),
            list: { error: signal(undefined), reload: vi.fn() },
            select,
          },
        },
        { provide: MatBottomSheet, useValue: { open } },
      ],
    });
    const fixture = TestBed.createComponent(OrganizationPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      [...host.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent!.includes(label) || b.getAttribute('aria-label') === label,
      )!;
    return { fixture, host, button };
  }

  const text = (host: HTMLElement) => host.textContent!.replace(/\s+/g, ' ');

  it('O2: renames the organization and keeps the saved message after the reload', async () => {
    const { fixture, host, button } = await render();
    const input = host.querySelector<HTMLInputElement>('input')!;
    expect(input.value).toBe('Barbería Don Lucho');
    input.value = 'Barbería Don Pepe';
    input.dispatchEvent(new Event('input'));
    button('Guardar nombre').click();
    await settle();
    await fixture.whenStable();

    expect(rename).toHaveBeenCalledWith('Barbería Don Pepe');
    expect(text(host)).toContain('Nombre guardado.');
    expect(input.value).toBe('Barbería Don Pepe');
  });

  it('shows pibble’s error when renaming fails', async () => {
    const { fixture, host, button } = await render();
    rename.mockRejectedValue(new ApiError(402, 'PLAN_INACTIVE', ''));
    button('Guardar nombre').click();
    await settle();
    await fixture.whenStable();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('Tu plan venció');
  });

  it('O5: shows the plan, its end in Lima, and how to renew', async () => {
    const { host } = await render();
    expect(text(host)).toContain('Plan Max');
    expect(text(host)).toContain('Activo hasta el 6 nov. 2026');
    expect(text(host)).toContain('renovaciones@takodu.example');
  });

  it('O6: an inactive plan disables renaming and opening, but not archiving', async () => {
    const { host, button } = await render('owner', false);
    expect(text(host)).toContain('Vencido');
    expect(text(host)).toContain('Terminó el 6 nov. 2026');
    expect(button('Guardar nombre').disabled).toBe(true);
    expect(button('Abrir otro local').disabled).toBe(true);
    expect(button('Archivar Surco').disabled).toBe(false);
  });

  it('O4: opens, archives and edits establishments', async () => {
    const { button } = await render();
    button('Abrir otro local').click();
    expect(open).toHaveBeenCalledWith(OpenEstablishmentSheet, expect.anything());

    button('Archivar Surco').click();
    expect(open).toHaveBeenCalledWith(
      ArchiveEstablishmentSheet,
      expect.objectContaining({ data: SURCO }),
    );

    button('Editar datos de Surco').click();
    await settle();
    expect(select).toHaveBeenCalledWith('est-2');
    expect(TestBed.inject(Router).url).toBe('/ajustes/datos');
  });

  it('03 §5: is the owner’s', async () => {
    const { host } = await render('manager');
    expect(text(host)).toContain('no está disponible para tu rol');
    expect(host.querySelector('form')).toBeNull();
  });
});
