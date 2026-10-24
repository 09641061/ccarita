#!/usr/bin/env node
// Screenshots the style guide, sign-in and the signed-in frame at phone and desktop sizes, light
// and dark, for the pull request's Proof block. Needs `pnpm start`; screenshots are not committed.
// Usage: pnpm screenshots [base-url]   (default http://localhost:5173, output in screenshots/)
// Signed-in pages need pibble in dev mode and a user with an organization:
//   CCARITA_EMAIL=luis@example.com PIBBLE_LOG=/path/to/pibble.log pnpm screenshots
// The script signs in once with the code pibble prints (I3 allows five codes an hour).
// Browser: CHROMIUM_PATH, else Playwright's own (`pnpm exec playwright install chromium`).
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:5173';
const { CCARITA_EMAIL: email, PIBBLE_LOG: pibbleLog } = process.env;
const signedOut = { 'style-guide': '/dev/ui', 'sign-in': '/ingresar' };
const signedIn = { frame: '/agenda', more: '/mas' };
const viewports = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

await mkdir('screenshots', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
// One context keeps one session; size and color scheme change in place.
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();

async function capture(pages) {
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const [device, viewport] of Object.entries(viewports)) {
      await page.setViewportSize(viewport);
      for (const [name, path] of Object.entries(pages)) {
        if (name === 'more' && device === 'desktop') continue;
        await page.goto(baseUrl + path, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const file = `screenshots/${name}-${device}-${colorScheme}.png`;
        await page.screenshot({ path: file, fullPage: name === 'style-guide' });
        console.log(file);
      }
    }
  }
}

async function signIn() {
  const marker = `Dev sign-in code for ${email.toLowerCase()}:`;
  const before = (await readFile(pibbleLog, 'utf8')).split(marker).length;
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize(viewports.desktop);
  await page.goto(`${baseUrl}/ingresar`, { waitUntil: 'networkidle' });
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  for (let attempt = 0; attempt < 40; attempt++) {
    const parts = (await readFile(pibbleLog, 'utf8')).split(marker);
    if (parts.length > before) {
      await page.locator('app-code-input input').fill(parts.at(-1).trim().split(/\s/)[0]);
      await page.waitForURL((url) => !url.pathname.startsWith('/ingresar'));
      // With several organizations the picker asks; capture it and take the first one.
      if (new URL(page.url()).pathname === '/organizaciones') {
        await page.locator('mat-action-list button').first().waitFor();
        await page.screenshot({ path: 'screenshots/picker-desktop-light.png' });
        console.log('screenshots/picker-desktop-light.png');
        await page.locator('mat-action-list button').first().click();
        await page.waitForURL((url) => url.pathname !== '/organizaciones');
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`pibble printed no sign-in code for ${email} in ${pibbleLog}`);
}

await capture(signedOut);
if (email && pibbleLog) {
  await signIn();
  await capture(signedIn);
} else {
  console.log('Signed-in pages skipped: set CCARITA_EMAIL and PIBBLE_LOG.');
}
await browser.close();
