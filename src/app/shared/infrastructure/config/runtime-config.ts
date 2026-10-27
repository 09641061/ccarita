/** What a deployment sets in `public/config.json`; a missing file or field keeps the build's `environment` value. */
export interface RuntimeConfig {
  readonly apiBaseUrl: string;
  /** Where an owner writes to renew the plan (O5). */
  readonly renewalContact: string;
  /** Takodu's Meta app for Embedded Signup (W2); `null` where connecting WhatsApp is not set up. */
  readonly metaSignup: {
    readonly appId: string;
    readonly configId: string;
    readonly graphVersion: string;
  } | null;
}

/**
 * Reads `/config.json` before the app starts and lays it over `fallback`. Fields absent from the file, or the whole
 * file when it is missing or unreadable, keep the fallback, so a development build runs without one.
 */
export async function loadRuntimeConfig(
  fallback: RuntimeConfig,
  fetcher: typeof fetch = fetch,
): Promise<RuntimeConfig> {
  try {
    const response = await fetcher('/config.json', { cache: 'no-store' });
    if (!response.ok) return fallback;
    const file = (await response.json()) as Partial<RuntimeConfig>;
    return {
      apiBaseUrl: file.apiBaseUrl || fallback.apiBaseUrl,
      renewalContact: file.renewalContact || fallback.renewalContact,
      metaSignup: file.metaSignup === undefined ? fallback.metaSignup : file.metaSignup,
    };
  } catch {
    return fallback;
  }
}
