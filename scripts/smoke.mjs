// Loads the production build in a real browser and fails if anything is blank or throws.
// Run after `vite build`:  node scripts/smoke.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE = process.env.VITE_BASE ?? '/counter-studio/';
const PORT = 4173;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://localhost:${PORT}${BASE}`)).ok) break;
  } catch {
    /* not up yet */
  }
  await wait(500);
}

const problems = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}]`, m.text().slice(0, 500));
  if (m.type() === 'error') problems.push(`console error: ${m.text().slice(0, 200)}`);
});
page.on('pageerror', (e) => {
  console.log('[pageerror]', e.message, '\n', (e.stack ?? '').split('\n').slice(0, 8).join('\n'));
  problems.push(`page error: ${e.message}`);
});
page.on('requestfailed', (r) => {
  console.log('[requestfailed]', r.url(), r.failure()?.errorText);
  problems.push(`request failed: ${r.url()}`);
});
page.on('response', (r) => {
  if (r.status() >= 400) {
    console.log('[http]', r.status(), r.url());
    problems.push(`HTTP ${r.status()}: ${r.url()}`);
  }
});

const routes = ['', '#/', '#/counters', '#/templates', '#/stats', '#/history', '#/tools', '#/settings', '#/import'];
for (const r of routes) {
  await page.goto(`http://localhost:${PORT}${BASE}${r}`);
  await page.waitForTimeout(1200);
  const text = (await page.innerText('body').catch(() => '')).trim();
  const visible = await page.evaluate(() => {
    const el = document.querySelector('main') ?? document.getElementById('root');
    const b = el?.getBoundingClientRect();
    return { h: Math.round(b?.height ?? 0), kids: document.getElementById('root')?.children.length ?? 0 };
  });
  console.log(`route "${r}": text=${text.length} chars, rootChildren=${visible.kids}, mainHeight=${visible.h}`);
  if (text.length < 40) problems.push(`blank page at "${r}"`);
}
console.log('--- first 400 chars of home text ---');
await page.goto(`http://localhost:${PORT}${BASE}`);
await page.waitForTimeout(1000);
console.log((await page.innerText('body')).slice(0, 400));
console.log('--- root HTML head ---');
console.log((await page.evaluate(() => document.documentElement.outerHTML)).slice(0, 1500));

await browser.close();
server.kill();
if (problems.length) {
  console.log('\nSMOKE TEST FAILED:\n- ' + [...new Set(problems)].join('\n- '));
  process.exit(1);
}
console.log('\nSmoke test passed.');
