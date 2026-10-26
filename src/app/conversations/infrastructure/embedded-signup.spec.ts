import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../shared/domain/model/api-error';
import { EmbeddedSignup, META_SIGNUP } from './embedded-signup';

type Login = (response: { authResponse?: { code?: string } | null }) => void;

describe('EmbeddedSignup', () => {
  let login: ReturnType<typeof vi.fn<(callback: Login, options: Record<string, unknown>) => void>>;
  let init: ReturnType<typeof vi.fn>;

  function setUp(configured = true) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: META_SIGNUP,
          useValue: configured
            ? { appId: 'app-1', configId: 'cfg-1', graphVersion: 'v23.0' }
            : null,
        },
      ],
    });
    const window = TestBed.inject(DOCUMENT).defaultView as Window & { FB?: unknown };
    login = vi.fn();
    init = vi.fn();
    window.FB = { init, login };
    return TestBed.inject(EmbeddedSignup);
  }

  afterEach(() => {
    delete (TestBed.inject(DOCUMENT).defaultView as Window & { FB?: unknown }).FB;
  });

  function post(data: unknown, origin = 'https://www.facebook.com') {
    window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), origin }));
  }

  it('is off without a configuration', () => {
    expect(setUp(false).available).toBe(false);
  });

  it('W2: returns the code with the account and number Meta posted, in either order', async () => {
    const signup = setUp();
    expect(signup.available).toBe(true);

    const result = signup.launch();
    await vi.waitFor(() => expect(login).toHaveBeenCalled());
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ appId: 'app-1', version: 'v23.0' }),
    );
    const [callback, options] = login.mock.calls[0];
    expect(options).toMatchObject({
      config_id: 'cfg-1',
      response_type: 'code',
      extras: { featureType: 'whatsapp_business_app_onboarding' },
    });

    post(
      {
        type: 'WA_EMBEDDED_SIGNUP',
        event: 'FINISH',
        data: { waba_id: 'w-1', phone_number_id: 'p-1' },
      },
      'https://evil.example',
    );
    callback({ authResponse: { code: 'code-1' } });
    post({
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
      data: { waba_id: 'w-1', phone_number_id: 'p-1' },
    });

    expect(await result).toEqual({ code: 'code-1', wabaId: 'w-1', phoneNumberId: 'p-1' });
  });

  it('fails with SIGNUP_CANCELLED when the owner closes the window', async () => {
    const signup = setUp();
    const result = signup.launch();
    await vi.waitFor(() => expect(login).toHaveBeenCalled());

    login.mock.calls[0][0]({ authResponse: null });

    const error = await result.catch((e: unknown) => e);
    expect(ApiError.of(error).code).toBe('SIGNUP_CANCELLED');
    expect(ApiError.of(error).retryable).toBe(false);
  });
});
