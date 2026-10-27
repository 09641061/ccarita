/** Build defaults; a deployment overrides any of them in `public/config.json` (`RuntimeConfig`). */
export const environment = {
  apiBaseUrl: 'https://api.takodu.com',
  /** Where an owner writes to renew the plan. Placeholder until Takodu names the channel. */
  renewalContact: 'renovaciones@takodu.example',
  /**
   * Takodu's Meta app for Embedded Signup (`{ appId, configId, graphVersion }`, docs/07 §3); `null` until Takodu has
   * one in `public/config.json`, and connecting WhatsApp says it is not set up.
   */
  metaSignup: null as { appId: string; configId: string; graphVersion: string } | null,
};
