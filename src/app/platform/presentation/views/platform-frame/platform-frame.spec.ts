import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { SessionStore, SessionUser } from '../../../../iam/public-api';
import { PlatformFrame } from './platform-frame';

describe('PlatformFrame', () => {
  async function render() {
    const user = signal<SessionUser | null>(new SessionUser('u-ops', 'ops@takodu.pe', null));
    const signOut = vi.fn(async () => user.set(null));
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: SessionStore,
          useValue: {
            user,
            isSignedIn: () => user() !== null,
            signedOut: signal(true),
            signOut,
          },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PlatformFrame);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement, signOut, navigate };
  }

  it('names the area and the operator, with a way back to their businesses', async () => {
    const { host } = await render();
    expect(host.querySelector('.tag')!.textContent).toBe('Equipo Takodu');
    expect(host.querySelector('.who')!.textContent).toBe('ops@takodu.pe');
    expect(host.querySelector('a[aria-label="Mis negocios"]')!.getAttribute('href')).toBe(
      '/organizaciones',
    );
  });

  it('signs out and returns to sign-in', async () => {
    const { fixture, host, signOut, navigate } = await render();
    host.querySelector<HTMLButtonElement>('button[aria-label="Salir"]')!.click();
    await fixture.whenStable();
    expect(signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/ingresar'], { queryParams: { volver: undefined } });
  });
});
