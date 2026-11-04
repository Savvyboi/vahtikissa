import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = process.env.RELATIONSHIP_INTERACTIONS_PORT || '4234';
const url = process.env.BROWSER_TEST_URL || `http://localhost:${port}`;
const server = process.env.BROWSER_TEST_URL ? null : spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: port }, windowsHide: true, stdio: 'ignore'
});
const mapRoute = '/?view=full#/relationships?preset=dual';
const trendRoute = '/?view=full#/relationships?feature=keyword-comparisons&mp=1504&period=all&party=all&q=';

async function openMap(page) {
  await page.goto(url + mapRoute);
  const canvas = page.locator('[data-sna-canvas]');
  const toggle = page.locator('[data-sna-open]');
  await toggle.waitFor({ state: 'attached' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  const host = canvas.locator('.sna-cytoscape');
  await page.waitForFunction(() => document.querySelector('.sna-cytoscape')?._cyreg?.cy.nodes().length > 0);
  return { canvas, host, pan: page.locator('[data-sna-gestures]'), zoomIn: page.locator('[data-sna-zoom="in"]') };
}

async function mapPoint(canvas, xFraction = 0.025) {
  await canvas.scrollIntoViewIfNeeded();
  const { x, y, width, height } = await canvas.boundingBox();
  return { x: Math.round(x + width * xFraction), y: Math.round(y + height / 2) };
}

const viewport = host => host.evaluate(element => {
  const cy = element._cyreg.cy;
  return { zoom: cy.zoom(), pan: cy.pan() };
});
const scroll = page => page.evaluate(() => scrollY);

async function checkDesktopMap(page) {
  const { canvas, host, pan, zoomIn } = await openMap(page);
  const point = await mapPoint(canvas);
  const start = await viewport(host);
  await page.mouse.move(point.x, point.y);
  let beforeScroll = await scroll(page);
  await page.mouse.wheel(0, 124);
  await page.waitForFunction(before => scrollY > before, beforeScroll);
  assert.deepEqual(await viewport(host), start, 'Wheel scrolls the document without changing the viewport');

  await pan.click();
  assert.equal(await pan.getAttribute('aria-pressed'), 'true');
  const activePoint = await mapPoint(canvas);
  await page.mouse.move(activePoint.x, activePoint.y);
  beforeScroll = await scroll(page);
  await page.mouse.wheel(0, -124);
  await page.waitForFunction(zoom => document.querySelector('.sna-cytoscape')._cyreg.cy.zoom() > zoom, start.zoom);
  const zoomed = await viewport(host);
  for (const delta of [3, 7, 13, 12, 5]) await page.mouse.wheel(2, delta);
  await page.waitForFunction(zoom => document.querySelector('.sna-cytoscape')._cyreg.cy.zoom() < zoom, zoomed.zoom);
  assert.equal(await scroll(page), beforeScroll, 'Wheel and trackpad zoom leave the page in place with Pan map on');

  await page.locator('[data-sna-fit]').click();
  const drag = await mapPoint(canvas);
  await page.mouse.move(drag.x, drag.y);
  await page.mouse.down();
  await page.mouse.move(drag.x + 60, drag.y - 45, { steps: 6 });
  await page.mouse.up();
  assert.notDeepEqual((await viewport(host)).pan, start.pan, 'Opted-in mouse drag pans the map');
  await zoomIn.click();
  assert.ok((await viewport(host)).zoom > start.zoom, 'Zoom control changes scale');
  await page.locator('[data-sna-zoom="out"]').click();
  assert.ok(Math.abs((await viewport(host)).zoom - start.zoom) < 1e-8);
  await page.locator('[data-sna-fit]').click();
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  assert.notDeepEqual((await viewport(host)).pan, start.pan, 'Focused canvas still supports keyboard pan');
  await page.keyboard.press('Escape');
  assert.equal(await pan.getAttribute('aria-pressed'), 'false');
  assert.ok(await pan.evaluate(button => button === document.activeElement));
  const released = await viewport(host), releasedPoint = await mapPoint(canvas);
  await page.mouse.move(releasedPoint.x, releasedPoint.y);
  beforeScroll = await scroll(page);
  await page.mouse.wheel(0, 124);
  await page.waitForFunction(before => scrollY > before, beforeScroll);
  assert.deepEqual(await viewport(host), released, 'Escape restores native page scrolling');

  const fullscreen = page.locator('[data-sna-fullscreen]');
  const enterLabel = await fullscreen.textContent();
  await fullscreen.click();
  await page.waitForFunction(label => document.fullscreenElement?.id === 'sna-stage' && document.querySelector('[data-sna-fullscreen]').textContent !== label, enterLabel);
  await pan.click();
  await fullscreen.click();
  await page.waitForFunction(() => !document.fullscreenElement && document.querySelector('[data-sna-gestures]').getAttribute('aria-pressed') === 'false');
  assert.equal(await pan.getAttribute('aria-pressed'), 'false', 'Exiting fullscreen restores page gestures');
  assert.equal(await fullscreen.textContent(), enterLabel);
  await fullscreen.click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'sna-stage');
  await pan.click();
  // Trigger a browser-originated fullscreenchange outside the app's toggle handler.
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => document.querySelector('[data-sna-gestures]').getAttribute('aria-pressed') === 'false');
  assert.equal(await fullscreen.textContent(), enterLabel);

  await pan.click();
  const filter = page.locator('[data-sna-filters] [data-tool="query"]');
  if (!await filter.isVisible()) await page.locator('.sna-filters > summary').click();
  await filter.fill('no-such-map-connection');
  await pan.waitFor({ state: 'hidden' });
  await filter.fill('');
  await pan.waitFor();
  assert.equal(await pan.getAttribute('aria-pressed'), 'false', 'An empty map resets gesture mode');
}

async function touchGesture(cdp, start, deltas) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: start });
  for (const delta of deltas) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: start.map((point, i) => ({
      x: point.x + delta[i].x, y: point.y + delta[i].y, id: i
    })) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function checkTouchMap(page) {
  const { canvas, host, pan, zoomIn } = await openMap(page);
  const cdp = await page.context().newCDPSession(page);
  const swipe = point => touchGesture(cdp, [{ ...point, id: 0 }],
    [16, 32, 55, 82, 112].map(y => [{ x: 0, y: -y }]));
  const nodePoint = () => host.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const cy = element._cyreg.cy;
    const position = cy.nodes().map(node => node.renderedPosition())
      .find(point => rect.top + point.y > 220 && rect.top + point.y < innerHeight - 90);
    return { x: Math.round(rect.left + position.x), y: Math.round(rect.top + position.y) };
  });
  await mapPoint(canvas);
  const tap = await nodePoint();
  await page.touchscreen.tap(tap.x, tap.y);
  await page.locator('[data-sna-close]').waitFor();
  await page.locator('[data-sna-close]').tap();

  const start = await viewport(host);
  await pan.tap();
  assert.equal(await pan.getAttribute('aria-pressed'), 'true');
  const point = await mapPoint(canvas);
  const beforePan = await scroll(page);
  await swipe(point);
  assert.equal(await scroll(page), beforePan);
  assert.notDeepEqual((await viewport(host)).pan, start.pan, 'Touch drag pans after the reader opts in');
  const center = await mapPoint(canvas, 0.5);
  const beforePinch = await viewport(host);
  await touchGesture(cdp, [{ x: center.x - 45, y: center.y, id: 0 }, { x: center.x + 45, y: center.y, id: 1 }],
    [10, 25, 42, 59, 75].map(x => [{ x: -x, y: 0 }, { x, y: 0 }]));
  assert.ok((await viewport(host)).zoom > beforePinch.zoom, 'Pinch zooms after the reader opts in');
  const beforeButton = await viewport(host);
  await zoomIn.tap();
  assert.ok((await viewport(host)).zoom > beforeButton.zoom);
  await pan.tap();
  assert.equal(await pan.getAttribute('aria-pressed'), 'false');

  const fullscreen = page.locator('[data-sna-fullscreen]');
  if (!await fullscreen.isVisible()) await page.locator('.sna-map-tools > summary').tap();
  await fullscreen.tap();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'sna-stage');
  await pan.tap();
  assert.equal(await pan.getAttribute('aria-pressed'), 'true');
  await fullscreen.tap();
  await page.waitForFunction(() => !document.fullscreenElement && document.querySelector('[data-sna-gestures]').getAttribute('aria-pressed') === 'false');
  assert.equal(await pan.getAttribute('aria-pressed'), 'false');

  await mapPoint(canvas);
  const restored = await viewport(host);
  const beforeScroll = await scroll(page);
  await swipe(await nodePoint());
  await page.waitForFunction(before => scrollY > before, beforeScroll);
  assert.deepEqual(await viewport(host), restored, 'After fullscreen, a swipe starting on a node scrolls the page');
}

async function checkTrend(page, touch) {
  await page.goto(url + trendRoute);
  await page.locator('.language-select').selectOption('en');
  const trend = page.locator('details:has([data-keyword-timeline])');
  await trend.locator('summary')[touch ? 'tap' : 'click']();
  const picker = trend.locator('[data-keyword-month]');
  const detail = trend.locator('[data-keyword-month-detail]');
  const slots = trend.locator('[data-keyword-slot]');
  const dates = await picker.locator('option').evaluateAll(options => options.map(option => option.value));
  assert.ok(dates.length > 12);
  assert.equal(await slots.count(), dates.length);
  const labels = trend.locator('.relationship-keyword-axis:visible time');
  assert.ok(await labels.count() >= 3, 'The responsive axis shows intermediate month and year labels');
  assert.ok(await labels.evaluateAll(elements => elements.every((element, i) =>
    i === 0 || elements[i - 1].getBoundingClientRect().right < element.getBoundingClientRect().left)));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const bars = trend.locator('.relationship-keyword-timeline .relationship-bar');
  const tallest = await bars.evaluateAll(elements => Math.max(...elements.map(element => element.getBoundingClientRect().height)));
  assert.ok(tallest > 40, 'Nonzero chart bars reflect the scale');

  if (touch) {
    await slots.nth(5).tap({ position: { x: 2, y: 20 } });
    assert.equal(await picker.inputValue(), dates[5]);
    await picker.tap();
    await picker.selectOption(dates[6]);
  } else {
    await picker.focus();
    await page.keyboard.press('Home');
    assert.equal(await picker.inputValue(), dates[0]);
    assert.match(await detail.innerText(), /Partial month/);
    await page.keyboard.press('ArrowDown');
    assert.equal(await picker.inputValue(), dates[1]);
  }
  const activeDate = await picker.inputValue();
  assert.equal(await trend.locator('.is-selected').getAttribute('data-keyword-slot'), activeDate);
  const group = trend.locator('[data-keyword-trend]');
  await group.selectOption({ index: 1 });
  assert.equal(await picker.inputValue(), activeDate, 'Changing groups retains the inspected month');
  await group.selectOption({ index: 0 });
  const gap = await trend.locator('[data-keyword-slot]:has(.relationship-bar-gap)').first().getAttribute('data-keyword-slot');
  await picker.selectOption(gap);
  assert.match(await detail.innerText(), /No speeches in this group|No transcript words/);
  const zero = await trend.locator('[data-keyword-slot]:has(.relationship-bar[style="height:0%"]:not(.relationship-bar-gap))').first().getAttribute('data-keyword-slot');
  await picker.selectOption(zero);
  assert.match(await detail.innerText(), /· 0 mentions per 10,000 words/);
  await picker.selectOption(dates.at(-1));
  assert.match(await detail.innerText(), /Partial month/);

  if (!touch) {
    await page.goto(url + trendRoute + 'ministeri');
    await trend.locator('summary').click();
    const filteredDates = await picker.locator('option').evaluateAll(options => options.map(option => option.value));
    const calendar = dates.slice(dates.indexOf(filteredDates[0]), dates.indexOf(filteredDates.at(-1)) + 1);
    const chart = await trend.locator('.relationship-keyword-slot').evaluateAll(elements => elements.map(element => element.dataset.keywordSlot ?? null));
    assert.ok(chart.includes(null), 'The text filter creates blank calendar positions');
    assert.deepEqual(chart, calendar.map(date => filteredDates.includes(date) ? date : null));
  }
}

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* Wait for the preview. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'The preview server starts successfully');
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  for (const [width, touch] of [[1280, false], [390, true], [320, true]]) {
    const context = await browser.newContext({ viewport: { width, height: 850 }, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await checkTrend(page, touch);
    if (touch) await checkTouchMap(page);
    else await checkDesktopMap(page);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`${width}px ${touch ? 'touch' : 'desktop'}: map gestures and keyword month inspection passed.`);
  }
} finally {
  await browser?.close();
  server?.kill();
}
