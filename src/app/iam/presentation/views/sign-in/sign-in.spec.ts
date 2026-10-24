import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { SessionStore } from '../../../application/session.store';
import { SignIn } from './sign-in';

interface StoreStub {
  canResume: boolean;
  requestCode: ReturnType<typeof vi.fn>;
  signIn: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
}

describe('SignIn', () => {
  let store: StoreStub;

  async function render(url = '/ingresar?volver=%2Fclientes') {
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        provideRouter([{ path: 'ingresar', component: SignIn }], withComponentInputBinding()),
        { provide: SessionStore, useValue: store },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    return { harness, host: harness.routeNativeElement as HTMLElement, navigate };
  }

  async function typeEmail(harness: RouterTestingHarness, host: HTMLElement, value: string) {
    const input = host.querySelector<HTMLInputElement>('input[type="email"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
  }

  async function submit(harness: RouterTestingHarness, host: HTMLElement) {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    await harness.fixture.whenStable();
  }

  async function typeCode(harness: RouterTestingHarness, host: HTMLElement, value: string) {
    const input = host.querySelector<HTMLInputElement>('app-code-input input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
    await harness.fixture.whenStable();
  }

  beforeEach(() => {
    store = {
      canResume: false,
      requestCode: vi.fn().mockResolvedValue(undefined),
      signIn: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(false),
    };
  });

  it('asks for the email first and does not send an invalid one', async () => {
    const { harness, host } = await render();
    expect(host.querySelector('h1')?.textContent).toBe('Ingresa a Takodu');

    await typeEmail(harness, host, 'luis@');
    await submit(harness, host);

    expect(store.requestCode).not.toHaveBeenCalled();
    expect(host.querySelector('mat-error')?.textContent).toContain('Revisa el correo');
  });

  it('requests a code and asks for it, showing the email', async () => {
    const { harness, host } = await render();

    await typeEmail(harness, host, ' Luis@DonLucho.pe ');
    await submit(harness, host);

    expect(store.requestCode).toHaveBeenCalledWith('luis@donlucho.pe');
    expect(host.querySelector('h1')?.textContent).toBe('Revisa tu correo');
    expect(host.querySelector('.intro strong')?.textContent).toBe('luis@donlucho.pe');
    const code = host.querySelector('app-code-input input')!;
    expect(code.getAttribute('autocomplete')).toBe('one-time-code');
    expect(code.getAttribute('inputmode')).toBe('numeric');
  });

  it('blocks a second request while the first is pending', async () => {
    store.requestCode.mockReturnValue(new Promise(() => undefined));
    const { harness, host } = await render();

    await typeEmail(harness, host, 'luis@donlucho.pe');
    await submit(harness, host);
    await submit(harness, host);

    expect(store.requestCode).toHaveBeenCalledTimes(1);
    expect(host.querySelector('app-busy-button button')?.hasAttribute('disabled')).toBe(true);
  });

  it('shows LOGIN_CODE_LIMIT in Spanish and stays on the email', async () => {
    store.requestCode.mockRejectedValue(new ApiError(429, 'LOGIN_CODE_LIMIT', 'x'));
    const { harness, host } = await render();

    await typeEmail(harness, host, 'luis@donlucho.pe');
    await submit(harness, host);

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Pediste demasiados códigos',
    );
    expect(host.querySelector('h1')?.textContent).toBe('Ingresa a Takodu');
  });

  it('signs in when the sixth digit is pasted and goes back to volver', async () => {
    const { harness, host, navigate } = await render();
    await typeEmail(harness, host, 'luis@donlucho.pe');
    await submit(harness, host);

    await typeCode(harness, host, '04 29 17');

    expect(store.signIn).toHaveBeenCalledWith('luis@donlucho.pe', '042917');
    expect(navigate).toHaveBeenCalledWith('/clientes');
  });

  it('keeps the code and explains LOGIN_CODE_INVALID', async () => {
    store.signIn.mockRejectedValue(new ApiError(401, 'LOGIN_CODE_INVALID', 'x'));
    const { harness, host, navigate } = await render();
    await typeEmail(harness, host, 'luis@donlucho.pe');
    await submit(harness, host);

    await typeCode(harness, host, '482017');

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Ese código no es correcto o ya venció',
    );
    expect(host.querySelector('app-code-input')?.classList).toContain('invalid');
    expect(host.querySelector<HTMLInputElement>('app-code-input input')?.value).toBe('482017');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('never returns to another origin', async () => {
    const { harness, host, navigate } = await render('/ingresar?volver=https:%2F%2Fevil.test');
    await typeEmail(harness, host, 'luis@donlucho.pe');
    await submit(harness, host);
    await typeCode(harness, host, '042917');

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('offers to retry a stored session when pibble cannot be reached', async () => {
    store.canResume = true;
    store.restore.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    const { harness, host } = await render();
    await settle();
    await harness.fixture.whenStable();

    expect(host.querySelector('app-state-view h2')?.textContent).toBe(
      'No pudimos recuperar tu sesión',
    );
  });
});
