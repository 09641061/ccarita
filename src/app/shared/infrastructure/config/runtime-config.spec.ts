import { describe, expect, it } from 'vitest';
import { RuntimeConfig, loadRuntimeConfig } from './runtime-config';

const fallback: RuntimeConfig = {
  apiBaseUrl: 'http://localhost:8080',
  renewalContact: 'build@takodu.test',
  metaSignup: null,
};

const answering = (status: number, body: unknown) =>
  (() =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))) as unknown as typeof fetch;

describe('loadRuntimeConfig', () => {
  it('lays the file over the build values', async () => {
    const meta = { appId: '1', configId: '2', graphVersion: 'v23.0' };
    const config = await loadRuntimeConfig(
      fallback,
      answering(200, { apiBaseUrl: 'https://api.example', metaSignup: meta }),
    );

    expect(config).toEqual({
      apiBaseUrl: 'https://api.example',
      renewalContact: 'build@takodu.test',
      metaSignup: meta,
    });
  });

  it('keeps the build values without a file', async () => {
    expect(await loadRuntimeConfig(fallback, answering(404, {}))).toBe(fallback);
  });

  it('keeps the build values when the file cannot be read', async () => {
    const failing = (() => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch;

    expect(await loadRuntimeConfig(fallback, failing)).toBe(fallback);
  });

  it('lets the file turn Embedded Signup off', async () => {
    const withMeta = {
      ...fallback,
      metaSignup: { appId: '1', configId: '2', graphVersion: 'v23.0' },
    };

    expect(
      (await loadRuntimeConfig(withMeta, answering(200, { metaSignup: null }))).metaSignup,
    ).toBeNull();
  });
});
