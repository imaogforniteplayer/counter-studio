// Drives the production build through every page and mode and reports controls that are covered or overlap.
// Usage: node scripts/layout.mjs [baseUrl]   (CI starts `vite preview` first)
import { spawn } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { checkLayout } from './layout-check.mjs';

const external = process.argv[2];
const base = external ?? 'http://localhost:4173/counter-studio/';
const server = external ? null : spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 60 && !external; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 500));
}
const browser = await chromium.launch();
const sizes = [
  ['phone-360', { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['phone-390', { ...devices['iPhone 13'] }],
  ['tablet', { viewport: { width: 820, height: 1100 } }],
  ['laptop', { viewport: { width: 1280, height: 720 } }],
  ['wide', { viewport: { width: 1920, height: 1080 } }],
];
let total = 0;
const report = async (page, label, where) => {
  const issues = await checkLayout(page);
  if (issues.length) {
    total += issues.length;
    console.log(`\n[${label}] ${where}`);
    for (const i of issues) console.log('  - ' + i);
  } else console.log(`[${label}] ${where}: ok`);
};
const go = async (page, hash) => {
  await page.goto(base + hash);
  await page.waitForTimeout(500);
};
const click = async (page, name, opts = {}) => {
  try {
    await page.getByRole(opts.role ?? 'button', { name, exact: opts.exact }).first().click({ timeout: 2500 });
    await page.waitForTimeout(250);
    return true;
  } catch {
    return false;
  }
};

const only = process.env.SIZES ? process.env.SIZES.split(',') : null;
for (const [label, opts] of sizes) {
  if (only && !only.includes(label)) continue;
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${label}] pageerror: ${e.message}`));
  await go(page, '');
  await report(page, label, 'onboarding step 1');
  await click(page, 'Next');
  await report(page, label, 'onboarding step 2');
  await click(page, 'Next');
  await report(page, label, 'onboarding step 3');
  await click(page, 'Start counting');
  await report(page, label, 'home with a counter');

  // Make one counter of every template, so every mode gets drawn.
  await go(page, '#/templates');
  await report(page, label, 'templates');
  const useButtons = page.getByRole('button', { name: 'Use template' });
  const n = Math.min(await useButtons.count(), 40);
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    await go(page, '#/templates');
    const btn = page.getByRole('button', { name: 'Use template' }).nth(i);
    const card = btn.locator('xpath=ancestor::*[contains(@class,"card")][1]');
    const cardText = await card.innerText().catch(() => '');
    const badge = (/(Normal|Countdown|Goal|Score|Tally|Interval|Multi)/.exec(cardText) ?? [String(i)])[0];
    if (seen.has(badge)) continue;
    seen.add(badge);
    await btn.click().catch(() => {});
    await page.waitForTimeout(300);
    await report(page, label, `home: counter from template #${i} (${badge})`);
  }
  for (const [hash, name] of [['#/counters', 'my counters'], ['#/stats', 'statistics'], ['#/history', 'history'], ['#/settings', 'settings']]) {
    await go(page, hash);
    await report(page, label, name);
  }
  for (const tool of ['stopwatch', 'timer', 'dice', 'coin', 'number', 'picker', 'tempo', 'pace']) {
    await go(page, `#/tools?tool=${tool}`);
    await report(page, label, `tool: ${tool}`);
  }

  // Dialogs and menus
  await go(page, '#/');
  if (await click(page, 'New counter')) await report(page, label, 'new counter dialog');
  await page.keyboard.press('Escape');
  await go(page, '#/');
  await page.keyboard.press('?');
  await page.waitForTimeout(250);
  await report(page, label, 'shortcuts help');
  await page.keyboard.press('Escape');
  await go(page, '#/');
  if (await click(page, 'More controls', { role: 'button' }) || (await page.getByText('More controls').first().click({ timeout: 1500 }).then(() => true, () => false))) {
    await page.waitForTimeout(250);
    await report(page, label, 'home: more controls open');
  }
  await go(page, '#/counters');
  if (await click(page, /More|Options|Menu/i)) await report(page, label, 'counter menu open');
  await ctx.close();
}
await browser.close();
server?.kill();
console.log(`\n${total} layout problem(s) found.`);
process.exit(total ? 1 : 0);
