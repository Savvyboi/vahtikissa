import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SITE_URL, siteMetadata } from '../seo.js';

const port = process.env.SEO_TEST_PORT || '4194';
const url = process.env.BROWSER_TEST_URL || `http://localhost:${port}`;
const server = process.env.BROWSER_TEST_URL ? null : spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: port }, stdio: 'ignore', windowsHide: true
});
let browser;

try {
  let started = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(url)).ok) { started = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(started, 'The site server starts');
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });

  // Parse the served page with the browser's HTML parser, with no client rendering.
  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await staticContext.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.title(), siteMetadata().title);
    assert.equal(await page.locator('main.site-introduction, main .site-introduction').count(), 1);
    assert.ok(await page.locator('main h1').isVisible(), 'Crawlers and readers receive an actual homepage heading');
    assert.ok(await page.locator('main h2').count() >= 2, 'The initial page describes the service and its sources');
    assert.ok((await page.locator('main').innerText()).length > 400);
    assert.equal(await page.locator('h1').count(), 1, 'The non-JavaScript page has one primary heading');
    assert.equal(await page.locator('.site-introduction .loading').isVisible(), false, 'Loading UI is hidden when JavaScript is disabled');
    await mkdir(new URL('../.hermes-tmp.seo/', import.meta.url), { recursive: true });
    for (const [name, width, height] of [['mobile', 320, 740], ['desktop', 1440, 1000]]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: fileURLToPath(new URL(`../.hermes-tmp.seo/homepage-no-javascript-${name}.png`, import.meta.url)), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Static homepage fits ' + name);
    }
    const structured = JSON.parse(await page.locator('#site-structured-data').textContent());
    assert.equal(structured['@context'], 'https://schema.org');
    const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll(links => links.map(link => ({ url: link.href, type: link.type, rel: link.rel })));
    assert.ok(icons.some(icon => icon.type === 'image/svg+xml'), 'An SVG favicon is linked');
    assert.ok(icons.some(icon => icon.rel === 'apple-touch-icon'), 'An Apple touch icon is linked');
    assert.ok(icons.some(icon => /\.ico(?:\?|$)/.test(icon.url)), 'An ICO fallback is linked');
    for (const icon of icons) {
      const response = await page.request.get(icon.url);
      assert.equal(response.status(), 200, 'Favicon is served: ' + icon.url);
      assert.ok((await response.body()).length > 50);
      if (icon.type === 'image/svg+xml') assert.match(response.headers()['content-type'], /image\/svg\+xml/);
    }
  } finally { await staticContext.close(); }

  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let held, resolveHeld, requestTimeout;
    const requestHeld = new Promise((resolve, reject) => {
      resolveHeld = resolve;
      requestTimeout = setTimeout(() => reject(new Error('The app did not request its initial Parliament data')), 15000);
    });
    await page.route('**/data/parliament/core.json', route => { held = route; resolveHeld(); });
    await page.goto(`${url}/#/overview`, { waitUntil: 'domcontentloaded' });
    await requestHeld.finally(() => clearTimeout(requestTimeout));
    assert.ok(held, 'The initial data request can be delayed');
    assert.equal(await page.locator('main.site-introduction, main .site-introduction').isVisible(), true, 'The crawlable introduction survives initial data loading');
    await held.continue();
    await page.unroute('**/data/parliament/core.json');
    const ready = async route => {
      await page.waitForFunction(route => {
        const main = document.querySelector('main');
        return main?.getAttribute('aria-busy') === 'false' && main.dataset.route === route && main.querySelector('h1');
      }, route);
    };
    const metadata = async route => {
      await ready(route);
      const language = await page.locator('html').getAttribute('lang');
      const heading = (await page.locator('main h1').first().textContent()).trim();
      const [pageName, ...parts] = route.slice(2).split('/');
      const expected = siteMetadata(language, { page: pageName, id: parts.length ? decodeURIComponent(parts.join('/')) : null }, heading);
      assert.equal(await page.title(), expected.title);
      for (const [selector, value] of [
        ['meta[name="description"]', expected.description],
        ['meta[property="og:title"]', expected.title],
        ['meta[property="og:description"]', expected.description],
        ['meta[property="og:locale"]', expected.locale],
        ['meta[name="twitter:title"]', expected.title],
        ['meta[name="twitter:description"]', expected.description],
        ['meta[property="og:url"]', SITE_URL]
      ]) {
        assert.equal(await page.locator(selector).count(), 1, selector + ' is unique');
        assert.equal(await page.locator(selector).getAttribute('content'), value, selector + ' matches the current language and route');
      }
      assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), SITE_URL);
    };
    const navigate = async pageName => {
      const link = page.locator(`.nav a[data-page="${pageName}"]`);
      if (!await link.isVisible()) await page.locator('.menu-button').click();
      await link.click();
    };
    await metadata('#/overview');
    await navigate('votes');
    await metadata('#/votes');
    for (const language of ['sv', 'en', 'fi']) {
      await page.locator('.language-select').selectOption(language);
      await page.waitForFunction(language => document.documentElement.lang === language, language);
      await metadata('#/votes');
    }
    await navigate('members');
    await metadata('#/members');
    const detail = page.locator('main a[href^="#/members/"]').first();
    const detailRoute = await detail.getAttribute('href');
    await detail.click();
    await metadata(detailRoute);
    assert.ok((await page.title()).includes((await page.locator('main h1').textContent()).trim()));
    await page.goto(`${url}/?view=full#/votes`);
    await metadata('#/votes');
    assert.deepEqual(errors, [], 'Metadata integration does not cause browser errors');
  } finally { await context.close(); }
  console.log('Static homepage content, structured data, favicon delivery, localized route/detail metadata and canonical URL checks passed.');
} finally {
  await browser?.close();
  server?.kill();
}
