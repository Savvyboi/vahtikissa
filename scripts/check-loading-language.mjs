import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = process.env.LOADING_TEST_PORT || '4197';
const url = process.env.BROWSER_TEST_URL || `http://localhost:${port}`;
const server = process.env.BROWSER_TEST_URL ? null : spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: port }, stdio: 'ignore', windowsHide: true
});
const parliamentPath = fileURLToPath(new URL('../data/parliament/core.json', import.meta.url));
const programmes = await readFile(new URL('../data/programmes.json', import.meta.url), 'utf8');
let browser;
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  for (const outcome of ['success', 'failure']) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      let held;
      await page.route('**/data/parliament/core.json', route => { held = route; });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('.search-button').click();
      await page.locator('#global-search').fill('Orpo');
      await page.waitForFunction(() => document.querySelector('.search-status')?.textContent.includes('Ladataan'));
      assert.ok(held, 'The initial snapshot request must still be pending');
      if (outcome === 'success') {
        await held.fulfill({ path: parliamentPath, contentType: 'application/json' });
        await page.locator('main[aria-busy="false"] h1').waitFor();
        await page.locator('.search-results a').first().waitFor();
        assert.match(await page.locator('.search-status').innerText(), /tulosta/);
      } else {
        await held.abort('failed');
        await page.locator('main .load-error').waitFor();
        await page.waitForFunction(() => document.querySelector('.search-status')?.textContent.includes('Haku on käytettävissä'));
        assert.equal(await page.locator('.search-results a').count(), 0);
      }
      assert.equal(await page.locator('#global-search').inputValue(), 'Orpo');
      assert.equal(await page.locator('.search-panel').isVisible(), true);
    } finally { await context.close(); }
  }
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    let oldRequest, count = 0, resolveHeld;
    const platformHeld = new Promise(resolve => { resolveHeld = resolve; });
    await page.route('**/data/programmes.json', route => {
      count += 1;
      if (count === 1) { oldRequest = route; resolveHeld(); }
      else return route.fulfill({ status: 200, contentType: 'application/json', body: programmes });
    });
    await page.goto(url);
    await page.locator('main[aria-busy="false"] h1').waitFor();
    await page.evaluate(() => { location.hash = '#/programmes'; });
    await platformHeld;
    assert.ok(oldRequest, 'The Finnish platform request must be pending before changing language');
    await page.locator('.language-select').selectOption('sv');
    await page.locator('.programmes-page h1').waitFor();
    assert.equal(await page.locator('main h1').innerText(), 'Partiprogram · valet 2023');
    const failed = page.waitForEvent('requestfailed', { predicate: request => request.url().endsWith('/data/programmes.json') });
    await oldRequest.abort('failed');
    await failed;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('main h1').innerText(), 'Partiprogram · valet 2023', 'A stale failure must not replace a successful view in the new language');
    assert.equal(await page.locator('.load-error').count(), 0);
    assert.equal(await page.locator('html').getAttribute('lang'), 'sv');
    assert.equal(await page.locator('main').getAttribute('aria-busy'), 'false');
  } finally { await context.close(); }
  console.log('Startup search recovery for success/failure and stale language request protection passed.');
} finally {
  await browser?.close();
  server?.kill();
}
