// Drives the production build through every page, mode, menu and dialog on many screen shapes and reports
// controls that are covered, overlap, run off-screen, or text that spills out.
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
const phone = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const sizes = [
  ['phone-320', phone(320, 568), {}],
  ['phone-360', phone(360, 740), {}],
  ['phone-390', { ...devices['iPhone 13'] }, {}],
  ['phone-landscape', phone(740, 360), {}],
  ['phone-360-light', phone(360, 740), { light: true }],
  ['phone-360-bigtext', phone(360, 740), { bigText: true }],
  ['tablet', { viewport: { width: 820, height: 1100 } }, {}],
  ['laptop', { viewport: { width: 1280, height: 720 } }, {}],
  ['laptop-light-bigtext', { viewport: { width: 1280, height: 720 } }, { light: true, bigText: true }],
  ['wide', { viewport: { width: 1920, height: 1080 } }, {}],
];
const only = process.env.SIZES ? process.env.SIZES.split(',') : null;
let total = 0;
let misses = 0;

for (const [label, opts, flags] of sizes) {
  if (only && !only.includes(label)) continue;
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${label}] pageerror: ${e.message}`));
  if (flags.bigText) await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => (document.documentElement.style.fontSize = '20px')));

  const report = async (where) => {
    // Hide toasts rather than delete them: React owns those nodes and removing them behind its back crashes the page.
    await page.evaluate(() => document.querySelectorAll('.toast-in').forEach((t) => (t.style.display = 'none'))).catch(() => {});
    const crashed = await page.evaluate(() => /something went wrong/i.test(document.body.innerText)).catch(() => false);
    if (crashed) {
      total++;
      console.log(`\n[${label}] ${where}\n  - the app crashed and showed its error screen`);
      return;
    }
    const issues = await checkLayout(page).catch((e) => [`checker failed: ${e.message}`]);
    if (issues.length) {
      total += issues.length;
      console.log(`\n[${label}] ${where}`);
      for (const i of issues) console.log('  - ' + i);
    } else console.log(`[${label}] ${where}: ok`);
  };
  const go = async (hash) => {
    await clearDialogs();
    await page.goto(base + hash);
    await page.waitForTimeout(450);
  };
  // A control that cannot be clicked is reported, never silently skipped: it may be covered or missing.
  const click = async (locator, ms = 250, what = String(locator)) => {
    try {
      await locator.first().click({ timeout: 2500 });
      await page.waitForTimeout(ms);
      return true;
    } catch (e) {
      const msg = String(e.message || e).split('\n').slice(0, 3).join(' | ').slice(0, 240);
      console.log(`[${label}] could not click ${what}: ${msg}`);
      const state = await page
        .evaluate(() => {
          const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
          return {
            hash: location.hash,
            buttons: document.querySelectorAll('button').length,
            dialogs: document.querySelectorAll('[role=dialog]').length,
            inert: document.querySelectorAll('[inert], [aria-hidden=true]:not(svg):not(span)').length,
            crashed: /something went wrong/i.test(document.body.innerText),
            middle: top ? `${top.tagName}.${String(top.className).slice(0, 50)}` : 'nothing',
            text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
          };
        })
        .catch((err) => ({ evaluateFailed: String(err.message).slice(0, 80) }));
      console.log(`    page state: ${JSON.stringify(state)}`);
      misses++;
      return false;
    }
  };
  const btn = (name, exact) => page.getByRole('button', { name, exact });
  // Attribute selectors keep working even if the page behind a dialog is marked hidden to screen readers.
  const aria = (prefix) => page.locator(`button[aria-label^="${prefix}"]:visible`);
  const text = (t) => page.locator(`button:visible:has-text("${t}")`);
  // Escape closes the top dialog. A half-filled editor then asks "Discard your changes?", which a person would answer, so do the same.
  const esc = async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const discard = page.locator('button:visible:text-is("Discard")');
    if (await discard.count()) {
      await discard.first().click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(200);
    }
  };
  const clearDialogs = async () => {
    for (let i = 0; i < 4 && (await page.locator('[role=dialog]').count()); i++) await esc();
  };

  await go('');
  await report('onboarding step 1');
  await click(btn('Next'));
  await report('onboarding step 2');
  await click(btn('Next'));
  await report('onboarding step 3');
  await click(btn('Start counting'));
  await report('home with a counter');

  if (flags.light) {
    await go('#/settings');
    await click(page.getByRole('radio', { name: 'Light' })) || (await click(btn('Light')));
    await report('settings (light theme)');
  }

  // Counting, so history and statistics have data, and a very big number.
  await go('#/');
  for (let i = 0; i < 6; i++) await click(btn('Add 1', true), 40);
  await report('home after counting');
  if (await click(page.getByText('More controls').first())) {
    await report('home: more controls open');
    const amount = page.getByLabel('Custom amount');
    if (await amount.count()) {
      await amount.first().fill('987654321');
      await click(btn('Add', true));
      await report('home: nine-digit number');
    }
  }

  // Awkward names.
  await go('#/');
  if (await click(aria('New counter'))) {
    await report('new counter dialog');
    const nameInput = page.getByLabel(/^Name/).first();
    if (await nameInput.count()) {
      await nameInput.fill('A really quite extraordinarily long counter name that goes on and on without end');
      await click(text('Create'), 250, 'Create');
      await report('home: very long counter name');
    } else await esc();
  }

  // One counter of every template, so every mode gets drawn, plus the template dialogs.
  await go('#/templates');
  await report('templates');
  if (await click(btn(/^Customise/))) {
    await report('template customise dialog');
    await esc();
  }
  const n = Math.min(await page.getByRole('button', { name: 'Use template' }).count(), 9);
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    await go('#/templates');
    const use = page.getByRole('button', { name: 'Use template' }).nth(i);
    const card = use.locator('xpath=ancestor::*[contains(@class,"card")][1]');
    const mode = await card
      .locator('span')
      .filter({ hasText: /^(Counter|Countdown|Goal|Score|Tally|Interval|Multi-counter)$/ })
      .first()
      .innerText()
      .catch(() => String(i));
    if (seen.has(mode)) continue;
    seen.add(mode);
    await use.click().catch(() => {});
    await page.waitForTimeout(300);
    await report(`home: ${mode} counter`);
    if (await click(aria('Actions for'))) {
      await report(`home: ${mode} actions menu`);
      await esc();
    }
    await page.keyboard.press('f');
    await page.waitForTimeout(350);
    await report(`home: ${mode} full screen`);
    await esc();
    await page.waitForTimeout(200);
  }

  await go('#/');
  if (await click(page.locator('main button[aria-haspopup="menu"]:visible'), 250, 'counter switcher')) {
    await report('home: counter switcher menu');
    await esc();
  }
  if (await click(aria('Share'), 250, 'Share')) {
    await report('share dialog');
    await esc();
  }
  if (await click(aria('Reset'))) {
    await report('reset confirmation');
    await esc();
  }
  await page.keyboard.press('?');
  await page.waitForTimeout(250);
  await report('shortcuts help');
  await esc();

  // The editor, for each counter type.
  await go('#/');
  if (await click(aria('New counter'))) {
    await report('editor: choose a type');
    for (const mode of ['Counter', 'Countdown', 'Goal', 'Score', 'Tally', 'Interval', 'Multi-counter']) {
      if (await page.locator('[role=dialog] button:visible:has-text("Change type")').count()) await click(text('Change type'), 250, 'Change type');
      if (await click(page.locator(`[role=dialog] button:visible:has(span:text-is("${mode}"))`), 300, `type ${mode}`)) await report(`editor: ${mode}`);
    }
    await esc();
  }

  // Pages that depend on having counters and history.
  await go('#/counters');
  await report('my counters (grid)');
  if (await click(text('List'), 250, 'List view')) await report('my counters (list)');
  if (await click(aria('Actions for'))) {
    await report('my counters: card menu');
    await esc();
  }
  if (await click(text('New folder'), 250, 'New folder')) {
    await report('my counters: folder dialog');
    await esc();
  }
  for (const [hash, name] of [['#/stats', 'statistics'], ['#/history', 'history'], ['#/settings', 'settings']]) {
    await go(hash);
    await report(name);
  }
  for (const tool of ['stopwatch', 'timer', 'dice', 'coin', 'number', 'picker', 'tempo', 'pace']) {
    await go(`#/tools?tool=${tool}`);
    await report(`tool: ${tool}`);
  }
  await go('#/settings');
  if (await page.getByLabel('Background style').count()) {
    await page.getByLabel('Background style').selectOption('color').catch(() => {});
    await report('settings: colour background');
  }
  await ctx.close();
}
await browser.close();
server?.kill();
console.log(`\n${total} layout problem(s) found, ${misses} control(s) that could not be clicked.`);
process.exit(total ? 1 : 0);
