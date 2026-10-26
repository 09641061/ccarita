import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fakeResource } from '../../../../../testing/fake-resource';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { ACCOUNT_WORKSPACE } from '../../../application/account-workspace';
import { AccountSessionsStore } from '../../../application/account-sessions.store';
import { SessionStore } from '../../../application/session.store';
import { AccountSession } from '../../../domain/model/account-session';
import { SessionUser } from '../../../domain/model/session-user';
import { Account } from './account';

const PHONE = new AccountSession(
  's-1',
  new Date('2026-10-26T14:05:00Z'),
  new Date('2026-11-25T14:05:00Z'),
  true,
);
const LAPTOP = new AccountSession(
  's-2',
  new Date('2026-10-20T01:30:00Z'),
  new Date('2026-11-19T01:30:00Z'),
  false,
);

describe('Account', () => {
  let signOut: ReturnType<typeof vi.fn>;
  let signOutDevice: ReturnType<typeof vi.fn>;
  let sessions: ReturnType<typeof fakeResource<AccountSession[]>>;

  async function render({ several = false } = {}) {
    signOut = vi.fn(async () => undefined);
    signOutDevice = vi.fn(async () => undefined);
    sessions = fakeResource<AccountSession[]>([PHONE, LAPTOP]);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([]),
        {
          provide: SessionStore,
          useValue: {
            user: signal(new SessionUser('u-1', 'luis@donlucho.pe', 'Luis Ramírez')),
            signOut,
          },
        },
        { provide: AccountSessionsStore, useValue: { sessions, signOut: signOutDevice } },
        {
          provide: ACCOUNT_WORKSPACE,
          useValue: { timeZone: signal('America/Lima'), canSwitchOrganization: signal(several) },
        },
      ],
    });
    const fixture = TestBed.createComponent(Account);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const items = () => [...host.querySelectorAll('li')];
    return { fixture, host, items };
  }

  const text = (el: Element) => el.textContent!.replace(/\s+/g, ' ').trim();

  it('I1: shows who is signed in', async () => {
    const { host } = await render();
    expect(text(host.querySelector('.you')!)).toBe('LRLuis Ramírezluis@donlucho.pe');
  });

  it('I5: lists the devices with this one marked, in the establishment’s zone', async () => {
    const { items } = await render();
    expect(text(items()[0])).toContain('Este dispositivo');
    expect(text(items()[0])).toContain('Último uso: lun, 26 oct., 09:05');
    expect(text(items()[1])).toContain('Otro dispositivo');
    expect(text(items()[1])).toContain('Último uso: lun, 19 oct., 20:30');
  });

  it('I5: signs another device out and says it loses access soon', async () => {
    const { fixture, host, items } = await render();
    items()[1].querySelector<HTMLButtonElement>('button')!.click();
    await settle();
    await fixture.whenStable();

    expect(signOutDevice).toHaveBeenCalledWith(LAPTOP);
    expect(host.querySelector('[role="status"]')!.textContent).toContain('menos de 15 minutos');
  });

  it('shows why a device could not be signed out', async () => {
    const { fixture, items } = await render();
    signOutDevice.mockRejectedValue(new ApiError(404, 'SESSION_NOT_FOUND', ''));
    items()[1].querySelector<HTMLButtonElement>('button')!.click();
    await settle();
    await fixture.whenStable();

    expect(items()[1].querySelector('[role="alert"]')!.textContent).toContain(
      'Esa sesión ya estaba cerrada.',
    );
    expect(sessions.reload).toHaveBeenCalled();
  });

  it('offers another organization only with several, and signs out', async () => {
    const one = await render();
    expect(one.host.querySelector('a[href="/organizaciones"]')).toBeNull();
    [...one.host.querySelectorAll<HTMLButtonElement>('.actions button')]
      .find((b) => b.textContent!.includes('Salir'))!
      .click();
    expect(signOut).toHaveBeenCalled();

    TestBed.resetTestingModule();
    const several = await render({ several: true });
    expect(several.host.querySelector('a[href="/organizaciones"]')).not.toBeNull();
  });

  it('renders the loading, error and offline states', async () => {
    const { fixture, host } = await render();
    sessions.value.set([]);
    sessions.isLoading.set(true);
    await fixture.whenStable();
    expect(host.querySelector('app-skeleton')).not.toBeNull();

    sessions.isLoading.set(false);
    sessions.error.set(new ApiError(0, 'NETWORK_ERROR', ''));
    await fixture.whenStable();
    expect(host.querySelector('app-state-view.offline')).not.toBeNull();
    host.querySelector<HTMLButtonElement>('app-state-view button')!.click();
    expect(sessions.reload).toHaveBeenCalled();
  });
});
