#!/usr/bin/env node
// Screenshots the style guide, sign-in, the calendar, customers and the inbox at phone and desktop sizes, light
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
// A page is a path, or a path and the click that reaches it (the week view, the first appointment).
const signedIn = {
  calendar: '/agenda',
  'calendar-week': [
    '/agenda',
    (page) =>
      page
        .getByRole('radio', { name: 'Semana' })
        .or(page.getByRole('button', { name: 'Ver semana' }))
        .click(),
  ],
  appointment: ['/agenda', (page) => page.locator('a[href^="/agenda/citas/"]').first().click()],
  book: '/agenda/reservar',
  'book-time': [
    '/agenda/reservar',
    async (page) => {
      await page.locator('app-customer-step .customer').first().click();
      await page.locator('.option').first().click();
      await page.locator('app-slot-picker .slot').first().click();
    },
  ],
  customers: '/clientes',
  customer: [
    '/clientes',
    async (page) => {
      await page.getByLabel('Buscar por nombre o teléfono').fill('Rosa');
      await page.waitForLoadState('networkidle');
      await page.locator('app-customer-list li a.row').first().click();
    },
  ],
  'customer-new': '/clientes/nuevo',
  inbox: '/bandeja',
  chat: ['/bandeja', (page) => page.locator('app-conversation-row').first().click()],
  more: '/mas',
};
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
      for (const [name, target] of Object.entries(pages)) {
        if (name === 'more' && device === 'desktop') continue;
        const [path, step] = Array.isArray(target) ? target : [target];
        await page.goto(baseUrl + path, { waitUntil: 'load' });
        await idle();
        if (step) {
          await step(page);
          await idle();
          // In-app navigation runs a view transition; let it finish.
          await page.waitForTimeout(600);
        }
        await page.evaluate(() => document.fonts.ready);
        const file = `screenshots/${name}-${device}-${colorScheme}.png`;
        await page.screenshot({ path: file, fullPage: name === 'style-guide' });
        console.log(file);
      }
    }
  }
}

/** The network goes quiet, except for the inbox stream, which never ends. */
async function idle() {
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => undefined);
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
