import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const port = process.env.PERFORMANCE_TEST_PORT || '4202';
const url = process.env.BROWSER_TEST_URL || `http://localhost:${port}`;
const server = process.env.BROWSER_TEST_URL ? null : spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: port }, stdio: 'ignore', windowsHide: true
});
const source = JSON.parse(await readFile(new URL('../data/parliament.json', import.meta.url), 'utf8'));
const sourceBytes = Buffer.byteLength(JSON.stringify(source));
let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  await mkdir(new URL('../.hermes-tmp.performance/', import.meta.url), { recursive: true });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage(), requests = [], errors = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    if (viewport.width < 600) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      window.longTasks = [];
      new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: 'longtask', buffered: true });
    });
    for (const view of ['full', 'simple']) {
      requests.length = 0;
      await page.goto(`${url}/?view=${view}#/overview`);
      await page.locator('main[aria-busy="false"] h1').waitFor();
      const metrics = await page.evaluate(() => ({
        readyMs: Math.round(performance.now()),
        dataBytes: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/data/')).reduce((total, entry) => total + entry.decodedBodySize, 0),
        scriptBytes: performance.getEntriesByType('resource').filter(entry => entry.initiatorType === 'script').reduce((total, entry) => total + entry.decodedBodySize, 0),
        blockingMs: Math.round(longTasks.reduce((total, duration) => total + Math.max(0, duration - 50), 0))
      }));
      assert.ok(metrics.dataBytes < sourceBytes * .15, `Home payload must stay below 15% of the complete snapshot: ${metrics.dataBytes}`);
      assert.ok(!requests.some(path => /parliament\.json|speech-search|speech-texts|\/parliament\/(speeches|member-|vote-)/.test(path)), 'The home page must not request complete or scoped detail collections');
      if (view === 'full') {
        assert.ok(metrics.scriptBytes < 230000, `Detailed home JavaScript budget: ${metrics.scriptBytes}`);
        assert.ok(!requests.some(path => /\/(simple-mode|simple-civic|civic-apps|programmes-app)\.js$/.test(path)), 'Unused reading/civic modules must remain lazy');
      }
      console.log(JSON.stringify({ viewport: viewport.width, view, ...metrics }));
      const arrow = page.locator('.back-to-top');
      assert.equal(await arrow.isVisible(), false, 'Arrow stays hidden at the top');
      for (const [lang, label] of [['fi', 'Takaisin ylös'], ['sv', 'Tillbaka till toppen'], ['en', 'Back to top']]) {
        await page.locator('.language-select').selectOption(lang);
        await page.locator('main[aria-busy="false"] h1').waitFor();
        await page.evaluate(() => window.scrollTo({ top: 650, behavior: 'instant' }));
        await arrow.waitFor({ state: 'visible' });
        assert.equal(await arrow.getAttribute('aria-label'), label);
        const box = await arrow.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, 'Arrow has a comfortable touch target');
        assert.ok(box.x >= 0 && box.x + box.width <= viewport.width, 'Arrow fits the viewport');
        const hash = new URL(page.url()).hash;
        await arrow.focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => scrollY === 0);
        assert.equal(new URL(page.url()).hash, hash, 'Back to top preserves the route');
        assert.equal(await page.locator('main').evaluate(element => element === document.activeElement), true, 'Keyboard focus returns to the content');
        await arrow.waitFor({ state: 'hidden' });
      }
      for (const theme of ['light', 'dark', 'contrast']) {
        await page.locator('.theme-select').selectOption(theme);
        await page.evaluate(() => window.scrollTo({ top: 650, behavior: 'instant' }));
        await arrow.waitFor({ state: 'visible' });
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
        const violations = await page.evaluate(async () => (await axe.run('.back-to-top')).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
        assert.deepEqual(violations, [], `${view} ${theme} arrow accessibility`);
      }
      await page.screenshot({ path: fileURLToPath(new URL(`../.hermes-tmp.performance/arrow-${view}-${viewport.width}.png`, import.meta.url)) });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await arrow.click();
      await page.waitForFunction(() => scrollY === 0);
      await arrow.waitFor({ state: 'hidden' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('.theme-select').selectOption('light');
      await page.locator('.language-select').selectOption('fi');
    }
    // Details must request their own small shard, without pulling all ballots/speech metadata.
    for (const route of [`votes/${encodeURIComponent(source.votes[0].id)}`, `members/${encodeURIComponent(source.members[0].id)}`]) {
      requests.length = 0;
      await page.goto(`${url}/?view=full#/${route}`);
      await page.locator('main[aria-busy="false"] h1').waitFor();
      assert.equal(await page.locator('.load-error').count(), 0);
      assert.ok(requests.some(path => /\/parliament\/(vote|member)-0\.json$/.test(path)), `${route} loads a scoped shard`);
      assert.ok(!requests.some(path => /parliament\.json$|\/parliament\/speeches\.json$/.test(path)), `${route} avoids the complete Parliament and speech files`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  const recoveryContext = await browser.newContext();
  const recovery = await recoveryContext.newPage();
  await recovery.goto(url + '/?view=full#/overview');
  await recovery.locator('main[aria-busy="false"] h1').waitFor();
  const failurePattern = '**/data/parliament/vote-0.json?*';
  await recovery.route(failurePattern, route => route.abort('failed'));
  const voteHash = '#/votes/' + encodeURIComponent(source.votes[0].id);
  await recovery.evaluate(hash => { location.hash = hash; }, voteHash);
  await recovery.locator('.load-error').waitFor();
  await recovery.goBack();
  await recovery.waitForFunction(() => document.querySelector('main')?.dataset.route === '#/overview' && !document.querySelector('.load-error'));
  await recovery.evaluate(hash => { location.hash = hash; }, voteHash);
  await recovery.locator('.load-error').waitFor();
  await recovery.unroute(failurePattern);
  await recovery.locator('[data-retry]').click();
  await recovery.locator('main[aria-busy="false"] .voter-list').waitFor();
  assert.equal(await recovery.locator('.load-error').count(), 0, 'Failed detail requests can retry');
  await recoveryContext.close();
  console.log('Desktop/mobile payload budgets, scoped details, arrow labels, keyboard focus, reduced motion and theme accessibility passed.');
} finally { await browser?.close(); server?.kill(); }
