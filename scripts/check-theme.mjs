#!/usr/bin/env node
// Compiles src/styles.scss and checks that every role in THEME_ROLES is emitted as
// `--mat-sys-<role>: light-dark(<light>, <dark>)`. mat.theme-overrides silently drops a role
// name Material does not know, so a typo would otherwise leave a generated color in place.
// Usage: node scripts/check-theme.mjs   (exit 1 on any missing or different role)
import { compile } from 'sass';
import { THEME_ROLES } from '../src/app/shared/presentation/theme/theme-roles.ts';

const { css } = compile('src/styles.scss', { loadPaths: ['node_modules'], quietDeps: true });
const htmlBlock = css.slice(css.indexOf('html {'));
const declared = new Map();
for (const [, name, value] of htmlBlock.matchAll(/--mat-sys-([a-z-]+):\s*([^;]+);/g)) {
  declared.set(name, value.trim().toLowerCase()); // the last declaration wins, as in the browser
}

let failures = 0;
for (const { role, light, dark } of THEME_ROLES) {
  const expected = `light-dark(${light}, ${dark})`.toLowerCase();
  const actual = declared.get(role);
  if (actual !== expected) {
    console.error(`check-theme: --mat-sys-${role} is ${actual ?? 'missing'}, expected ${expected}`);
    failures++;
  }
}
if (failures > 0) process.exit(1);
console.log(`check-theme: ${THEME_ROLES.length} M3 roles carry Takodu tokens`);
