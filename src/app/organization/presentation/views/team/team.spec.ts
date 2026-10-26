import { BreakpointObserver } from '@angular/cdk/layout';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { of } from 'rxjs';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { TeamStore } from '../../../application/team.store';
import { Establishment } from '../../../domain/model/establishment';
import { Member } from '../../../domain/model/member';
import { MemberRole } from '../../../domain/model/member-role';
import { TeamCaller } from '../../../domain/model/team-caller';
import { MemberSheet } from '../member-sheet/member-sheet';
import { RemoveMemberSheet } from '../remove-member-sheet/remove-member-sheet';
import { TransferOwnershipSheet } from '../transfer-ownership-sheet/transfer-ownership-sheet';
import { Team } from './team';

const NOW = new Date('2026-10-26T15:00:00Z');
const MIRAFLORES = new Establishment('est-1', 'Miraflores', '', 'America/Lima', null);
const SURCO = new Establishment('est-2', 'Surco', '', 'America/Lima', null);
const LUIS = new Member(
  'm-1',
  'luis@donlucho.pe',
  'Luis Ramírez',
  'owner',
  true,
  'active',
  [],
  new Date('2026-09-02T15:00:00Z'),
);
const KEVIN = new Member(
  'm-2',
  'kevin@gmail.com',
  'Kevin Flores',
  'manager',
  true,
  'active',
  [],
  new Date('2026-09-04T15:00:00Z'),
);
const ANDREA = new Member(
  'm-3',
  'andrea@hotmail.com',
  'Andrea Pinto',
  'staff',
  false,
  'active',
  ['est-1', 'est-2'],
  new Date('2026-09-04T15:00:00Z'),
);
const VALERIA = new Member(
  'm-4',
  'vale@gmail.com',
  'Valeria Castro',
  'staff',
  true,
  'pending',
  ['est-2'],
  null,
  new Date('2026-10-28T15:00:00Z'),
);
const OLD = new Member(
  'm-5',
  'old@gmail.com',
  'Joel Mendoza',
  'staff',
  true,
  'pending',
  ['est-1'],
  null,
  new Date('2026-10-20T15:00:00Z'),
);

describe('Team', () => {
  let open: ReturnType<typeof vi.fn>;
  let renewInvitation: ReturnType<typeof vi.fn>;
  let members: ReturnType<typeof fakeResource<Member[]>>;

  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: NOW }));
  afterEach(() => vi.useRealTimers());

  async function render(
    role: MemberRole = 'owner',
    { desktop = true, list = [LUIS, KEVIN, ANDREA, VALERIA, OLD] } = {},
  ) {
    open = vi.fn(() => ({ afterDismissed: () => of(undefined) }));
    renewInvitation = vi.fn(async () => VALERIA);
    members = fakeResource<Member[]>(list);
    const callerId = role === 'owner' ? LUIS.id : role === 'manager' ? KEVIN.id : ANDREA.id;
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: desktop, breakpoints: {} }) },
        },
        {
          provide: TeamStore,
          useValue: { members, caller: signal(new TeamCaller(callerId, role)), renewInvitation },
        },
        {
          provide: CurrentOrganization,
          useValue: { selected: signal({ id: 'org-1', name: 'Barbería Don Lucho' }) },
        },
        {
          provide: CurrentEstablishment,
          useValue: {
            timeZone: signal('America/Lima'),
            list: { value: signal([MIRAFLORES, SURCO]) },
            establishments: signal([MIRAFLORES, SURCO]),
          },
        },
        { provide: MatBottomSheet, useValue: { open } },
      ],
    });
    const fixture = TestBed.createComponent(Team);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    return { fixture, host };
  }

  const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
  const row = (host: HTMLElement, name: string) =>
    [...host.querySelectorAll('tbody tr, li.card')].find((r) => r.textContent!.includes(name))!;
  async function menu(
    host: HTMLElement,
    fixture: { whenStable(): Promise<unknown> },
    name: string,
  ) {
    row(host, name).querySelector<HTMLButtonElement>('button[aria-label^="Opciones"]')!.click();
    await fixture.whenStable();
    return [...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button')].map(
      (b) => b,
    );
  }

  it('lists people with role, bookability, establishments and status in Lima', async () => {
    const { host } = await render();

    expect(text(host.querySelector('header p'))).toBe('Personas: 5 · Barbería Don Lucho');
    const cells = (name: string) =>
      [...row(host, name).querySelectorAll('td')].map((td) => text(td));
    expect(cells('Luis').slice(0, 5)).toEqual([
      'LR Luis Ramírez (Tú)luis@donlucho.pe',
      'Dueño',
      'Sí',
      'Todos los locales',
      'checkActivodesde 2 set.',
    ]);
    expect(cells('Andrea').slice(1, 4)).toEqual(['Personal', 'No', 'Miraflores, Surco']);
    expect(cells('Valeria')[4]).toBe('mailInvitación enviadavence 28 oct.');
    expect(cells('Joel')[4]).toBe('scheduleInvitación vencidavenció el 20 oct.');
  });

  it('shows a list of cards on phones', async () => {
    const { host } = await render('owner', { desktop: false });
    expect(host.querySelector('table')).toBeNull();
    expect(host.querySelectorAll('li.card')).toHaveLength(5);
  });

  it('O12: the owner edits their own row but neither removes it nor changes its role', async () => {
    const { host, fixture } = await render();
    const items = await menu(host, fixture, 'Luis');
    expect(items.map((b) => text(b))).toEqual(['editEditar']);

    items[0].click();
    expect(open).toHaveBeenCalledWith(
      MemberSheet,
      expect.objectContaining({
        data: expect.objectContaining({ member: LUIS, canChangeRole: false }),
      }),
    );
  });

  it('03 §5: a manager leaves the owner alone and offers the rest', async () => {
    const { host, fixture } = await render('manager');
    expect(row(host, 'Luis').querySelector('button')).toBeNull();
    expect(host.textContent).not.toContain('Transferir propiedad');

    const items = await menu(host, fixture, 'Andrea');
    expect(items.map((b) => text(b))).toEqual(['editEditar', 'person_removeQuitar del equipo']);
  });

  it('opens the invite, remove and transfer sheets', async () => {
    const { host, fixture } = await render();
    const button = (label: string) =>
      [...host.querySelectorAll<HTMLButtonElement>('header button')].find((b) =>
        b.textContent!.includes(label),
      )!;

    button('Invitar').click();
    expect(open).toHaveBeenLastCalledWith(
      MemberSheet,
      expect.objectContaining({
        data: { member: null, canChangeRole: true, establishments: [MIRAFLORES, SURCO] },
        ariaLabel: 'Invitar a alguien',
      }),
    );

    button('Transferir propiedad').click();
    expect(open).toHaveBeenLastCalledWith(
      TransferOwnershipSheet,
      expect.objectContaining({ data: [KEVIN, ANDREA] }),
    );

    const items = await menu(host, fixture, 'Valeria');
    items.find((b) => b.textContent!.includes('Revocar'))!.click();
    expect(open).toHaveBeenLastCalledWith(
      RemoveMemberSheet,
      expect.objectContaining({
        data: VALERIA,
        ariaLabel: '¿Revocar la invitación de Valeria Castro?',
      }),
    );
  });

  it('O10: sends an invitation again, reusing the key only after a lost answer', async () => {
    const { host, fixture } = await render();
    renewInvitation.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', ''));
    const renew = async () => {
      const items = await menu(host, fixture, 'Valeria');
      items.find((b) => b.textContent!.includes('Reenviar'))!.click();
      await settle();
      await fixture.whenStable();
    };

    await renew();
    expect(text(row(host, 'Valeria'))).toContain('Sin conexión');
    await renew();
    expect(renewInvitation.mock.calls[1]).toEqual(renewInvitation.mock.calls[0]);
    expect(text(row(host, 'Valeria'))).toContain('Enviamos un enlace nuevo a vale@gmail.com.');
    await renew();
    expect(renewInvitation.mock.calls[2][1]).not.toBe(renewInvitation.mock.calls[1][1]);
  });

  it('renders the loading, empty, error, offline and no-permission states', async () => {
    const { host, fixture } = await render('owner', { list: [] });
    expect(host.textContent).toContain('Todavía estás solo');

    members.error.set(new ApiError(0, 'NETWORK_ERROR', ''));
    await fixture.whenStable();
    expect(host.textContent).toContain('No hay conexión');
    host.querySelector<HTMLButtonElement>('app-state-view button')!.click();
    expect(members.reload).toHaveBeenCalled();

    members.error.set(new ApiError(500, 'UNEXPECTED_ERROR', ''));
    await fixture.whenStable();
    expect(host.querySelector('app-state-view.error')).not.toBeNull();

    members.error.set(undefined);
    members.isLoading.set(true);
    await fixture.whenStable();
    expect(host.querySelector('mat-progress-bar')).not.toBeNull();
    expect(host.querySelector('app-skeleton')).not.toBeNull();
  });

  it('03 §5: staff see no team management', async () => {
    const { host } = await render('staff');
    expect(host.textContent).toContain('no está disponible para tu rol');
    expect(host.querySelector('table')).toBeNull();
  });
});
