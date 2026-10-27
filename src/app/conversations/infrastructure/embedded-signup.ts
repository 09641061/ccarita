import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { ApiError } from '../../shared/domain/model/api-error';
import { SignupResult } from '../domain/model/whatsapp-line';

/** Takodu's Meta app and its Embedded Signup configuration (docs/07 §3); `null` where none is set up. */
export interface MetaSignupConfig {
  readonly appId: string;
  readonly configId: string;
  /** Graph API version for the SDK, such as `v23.0`. */
  readonly graphVersion: string;
}

export const META_SIGNUP = new InjectionToken<MetaSignupConfig | null>('MetaSignup', {
  factory: () => null,
});

const SDK_URL = 'https://connect.facebook.net/en_US/sdk.js';

interface LoginResponse {
  readonly authResponse?: { readonly code?: string } | null;
}

interface FacebookSdk {
  init(options: Record<string, unknown>): void;
  login(callback: (response: LoginResponse) => void, options: Record<string, unknown>): void;
}

type MetaWindow = Window & { FB?: FacebookSdk; fbAsyncInit?: () => void };

/** What Meta posts to the page while Embedded Signup runs (`sessionInfoVersion` 3). */
interface SignupMessage {
  readonly type?: string;
  readonly event?: string;
  readonly data?: { readonly waba_id?: string; readonly phone_number_id?: string };
}

const cancelled = () => new ApiError(400, 'SIGNUP_CANCELLED', 'Embedded Signup was not finished');
const failed = () =>
  new ApiError(502, 'SIGNUP_META_ERROR', 'Meta reported an error in Embedded Signup');

/**
 * Meta's Embedded Signup in the coexistence flow (W2, docs/07 §3): loads Meta's SDK, opens its window, and returns
 * the single-use code with the WhatsApp account and number the owner chose, which pibble exchanges with Meta.
 * Off unless `META_SIGNUP` is configured; the site's Content Security Policy must then allow Meta's SDK.
 */
@Injectable({ providedIn: 'root' })
export class EmbeddedSignup {
  private readonly config = inject(META_SIGNUP);
  private readonly document = inject(DOCUMENT);
  private sdk: Promise<FacebookSdk> | null = null;

  readonly available = this.config !== null;

  /**
   * @throws ApiError `SIGNUP_CANCELLED` when the owner closes Meta's window without finishing, `SIGNUP_META_ERROR`
   * when Meta reports an error, and `SIGNUP_SDK_BLOCKED` when the browser or a blocker stops Meta's script.
   */
  async launch(): Promise<SignupResult> {
    const config = this.config;
    if (!config) throw new Error('Embedded Signup is not configured');
    const sdk = await this.load(config);
    const window = this.document.defaultView!;
    return new Promise<SignupResult>((resolve, reject) => {
      let code: string | null = null;
      let session: Omit<SignupResult, 'code'> | null = null;
      const stop = () => window.removeEventListener('message', listen);
      const finish = () => {
        if (code === null || session === null) return;
        stop();
        resolve({ code, ...session });
      };
      const fail = (error: ApiError) => {
        stop();
        reject(error);
      };
      const listen = (event: MessageEvent) => {
        if (!/(^|\.)facebook\.com$/.test(new URL(event.origin).hostname)) return;
        const message = parse(event.data);
        if (message?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (message.event?.startsWith('FINISH') && message.data?.waba_id) {
          session = {
            wabaId: message.data.waba_id,
            phoneNumberId: message.data.phone_number_id ?? '',
          };
          finish();
        } else if (message.event === 'CANCEL') {
          fail(cancelled());
        } else if (message.event === 'ERROR') {
          fail(failed());
        }
      };
      window.addEventListener('message', listen);
      sdk.login(
        (response) => {
          code = response.authResponse?.code ?? null;
          if (code === null) fail(cancelled());
          else finish();
        },
        {
          config_id: config.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: 'whatsapp_business_app_onboarding',
            sessionInfoVersion: '3',
          },
        },
      );
    });
  }

  private load(config: MetaSignupConfig): Promise<FacebookSdk> {
    this.sdk ??= new Promise<FacebookSdk>((resolve, reject) => {
      const window = this.document.defaultView as MetaWindow;
      const init = () => {
        window.FB!.init({
          appId: config.appId,
          autoLogAppEvents: true,
          version: config.graphVersion,
        });
        resolve(window.FB!);
      };
      if (window.FB) return init();
      window.fbAsyncInit = init;
      const script = this.document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => {
        this.sdk = null;
        reject(new ApiError(0, 'SIGNUP_SDK_BLOCKED', 'Meta SDK did not load'));
      };
      this.document.body.appendChild(script);
    });
    return this.sdk;
  }
}

function parse(data: unknown): SignupMessage | null {
  if (typeof data !== 'string') return (data as SignupMessage) ?? null;
  try {
    return JSON.parse(data) as SignupMessage;
  } catch {
    return null;
  }
}
