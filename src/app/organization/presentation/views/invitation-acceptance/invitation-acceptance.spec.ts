import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { SessionStore, SessionUser } from '../../../../iam/public-api';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { InvitationAcceptance } from './invitation-acceptance';

describe('InvitationAcceptance', () => {
  async function render(accept: () => Promise<unknown>) {
    const acceptInvitation = vi.fn(accept);
    const signOut = vi.fn(async () => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter(
          [
            { path: 'invitations/:token', component: InvitationAcceptance },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        { provide: CurrentOrganization, useValue: { acceptInvitation } },
        {
          provide: SessionStore,
          useValue: { user: signal(new SessionUser('u-1', 'srojas@outlook.com', null)), signOut },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/invitations/tok-1');
    await harness.fixture.whenStable();
    const host = harness.routeNativeElement as HTMLElement;
    const press = async () => {
      host.querySelector<HTMLButtonElement>('app-busy-button button')!.click();
      await settle();
      await harness.fixture.whenStable();
    };
    return { harness, host, press, acceptInvitation, signOut };
  }

  it('asks to accept as the signed-in email, then opens the calendar', async () => {
    const { host, press, acceptInvitation } = await render(async () => undefined);
    expect(host.querySelector('.intro')?.textContent).toContain('Entraste como srojas@outlook.com');

    await press();

    expect(acceptInvitation).toHaveBeenCalledWith('tok-1');
    expect(TestBed.inject(Router).url).toBe('/agenda');
  });

  it('says when the invitation expired', async () => {
    const { host, press } = await render(async () => {
      throw new ApiError(422, 'INVITATION_EXPIRED', 'x');
    });
    await press();

    expect(host.querySelector('app-state-view h2')?.textContent).toBe('Esta invitación venció');
  });

  it('explains a different email and signs out to come back', async () => {
    const { harness, host, press, signOut } = await render(async () => {
      throw new ApiError(403, 'ACCESS_DENIED', 'x');
    });
    await press();

    expect(host.querySelector('app-state-view h2')?.textContent).toBe(
      'La invitación es para otro correo',
    );
    expect(host.querySelector('.signed-in')?.textContent).toContain('srojas@outlook.com');

    host.querySelector<HTMLButtonElement>('app-state-view button')!.click();
    await settle();
    await harness.fixture.whenStable();
    expect(signOut).toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/ingresar?volver=%2Finvitations%2Ftok-1');
  });

  it('says when the link no longer works or someone else accepted it', async () => {
    const revoked = await render(async () => {
      throw new ApiError(404, 'INVITATION_NOT_FOUND', 'x');
    });
    await revoked.press();
    expect(revoked.host.querySelector('app-state-view h2')?.textContent).toBe(
      'Esta invitación ya no es válida',
    );
    TestBed.resetTestingModule();

    const taken = await render(async () => {
      throw new ApiError(409, 'INVITATION_CONFLICT', 'x');
    });
    await taken.press();
    expect(taken.host.querySelector('app-state-view h2')?.textContent).toBe(
      'Otra persona ya aceptó esta invitación',
    );
  });

  it('offers a retry when offline', async () => {
    const { host, press } = await render(async () => {
      throw new ApiError(0, 'NETWORK_ERROR', 'x');
    });
    await press();

    expect(host.querySelector('app-state-view h2')?.textContent).toBe('No hay conexión');
  });
});
