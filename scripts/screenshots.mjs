#!/usr/bin/env node
// Screenshots /dev/ui and the shell at phone and desktop sizes, light and dark, for the pull
// request's Proof block. Needs `pnpm start` running; screenshots are not committed.
// Usage: pnpm screenshots [base-url]   (default http://localhost:5173, output in screenshots/)
// Browser: CHROMIUM_PATH, else Playwright's own (`pnpm exec playwright install chromium`).
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:5173';
const pages = { 'style-guide': '/dev/ui', shell: '/agenda', more: '/mas' };
const viewports = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

await mkdir('screenshots', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const colorScheme of ['light', 'dark']) {
  for (const [device, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport, colorScheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const [name, path] of Object.entries(pages)) {
      if (name === 'more' && device === 'desktop') continue;
      await page.goto(baseUrl + path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const file = `screenshots/${name}-${device}-${colorScheme}.png`;
      await page.screenshot({ path: file, fullPage: name === 'style-guide' });
      console.log(file);
    }
    await context.close();
  }
}
await browser.close();
