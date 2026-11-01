import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url), port = process.env.TRANSPARENCY_TEST_PORT || '4215', url = process.env.BROWSER_TEST_URL || `http://localhost:${port}`;
const server = process.env.BROWSER_TEST_URL ? null : spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: port }, stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const errors = [];
await mkdir(new URL('../.hermes-tmp.sna/', import.meta.url), { recursive: true });
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch { /* Wait for the owned preview server. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'The preview server starts successfully');
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${url}/?view=full#/relationships`);
  await page.locator('[data-sna-canvas] canvas').first().waitFor({ timeout: 30000 });
  async function download(format) {
    const wait = page.waitForEvent('download'); await page.locator('[data-sna-export]').selectOption(format);
    const result = await wait; return readFile(await result.path());
  }
  const json = async () => JSON.parse(await download('json'));
  let exported = await json();
  assert.ok(exported.nodes.length > 0 && exported.nodes.length <= 100);
  assert.ok(exported.edges.length > 0 && exported.edges.length <= 200);
  assert.equal(Object.keys(exported.positions).length, exported.nodes.length);
  assert.equal(exported.snapshotId.length, 24);
  for (const preset of ['dual', 'brokers', 'interlocks', 'bills']) {
    await page.locator(`[data-sna-preset="${preset}"]`).click(); exported = await json();
    assert.equal(exported.preset, preset); assert.ok(exported.edges.length > 0, `${preset} has visible connections`);
    if (preset === 'dual') assert.ok(exported.edges.every(edge => edge.isDualRole));
    if (preset === 'brokers') assert.ok(exported.nodes.length <= 60);
    if (preset === 'interlocks') assert.ok(exported.edges.every(edge => edge.isCrossBloc && edge.sharedOrgs.length));
    if (preset === 'bills') assert.ok(exported.nodes.some(node => node.type === 'bill'));
    console.log(`Canvas preset ${preset}: ${exported.nodes.length} actors, ${exported.edges.length} ties.`);
  }
  await page.locator('[data-sna-preset="dual"]').click();
  await page.locator('[data-sna-records] [data-sna-inspect-edge]').first().click();
  await page.locator('[data-sna-evidence] .sna-disclosure').first().waitFor();
  await page.locator('[data-sna-evidence] summary').first().click();
  assert.ok(await page.locator('[data-sna-evidence] a[target="_blank"]').count());
  for (const mode of ['columns', 'rings', 'force']) { await page.locator('[data-sna-layout]').selectOption(mode); const view = await json(); assert.equal(view.layout, mode); if (mode === 'columns') assert.ok(view.nodes.some(node => node.type === 'committee')); }
  await page.locator('[data-sna-fullscreen]').click(); await page.waitForFunction(() => document.fullscreenElement?.id === 'sna-stage');
  await page.locator('[data-sna-fullscreen]').click(); await page.waitForFunction(() => document.fullscreenElement === null);
  await page.locator('[data-sna-metric]').selectOption('pagerank'); assert.equal((await json()).metric, 'pagerank');
  await page.locator('[data-sna-hull]').selectOption('party');
  for (const theme of ['light', 'dark', 'contrast']) {
    await page.locator('.theme-select').selectOption(theme); await page.waitForTimeout(100);
    const svg = (await download('svg')).toString();
    assert.ok(svg.includes('<svg') && svg.includes('<line') && svg.includes('<text'));
    if (theme === 'contrast') assert.ok(svg.includes('#000'), 'High contrast export follows the live theme');
  }
  const png = await download('png'); assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
  await page.addScriptTag({ content: axeSource });
  const audit = await page.evaluate(() => axe.run(document.querySelector('[data-sna-page]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
  assert.deepEqual(audit.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], 'Desktop accessibility');
  await page.locator('.theme-select').selectOption('light');
  await page.locator('[data-sna-preset="backbone"]').click();
  exported = await json();
  const firstEdge = exported.edges[0], a = exported.nodes.find(node => node.id === firstEdge.source), b = exported.nodes.find(node => node.id === firstEdge.target);
  await page.locator('#sna-path-a').fill(a.name); await page.locator('#sna-path-b').fill(b.name); await page.locator('[data-sna-path] button[type="submit"]').click();
  assert.ok((await page.locator('[data-sna-path-status]').textContent()).includes('→'));
  assert.equal((await json()).appearance.path.edges.length, 1);
  await page.locator('[data-sna-clear-path]').click();
  // Select and expand an actual rendered node using the exported viewport coordinates.
  const highDegree = exported.nodes.filter(node => node.type === 'mp').sort((a, b) => b.degree - a.degree)[0];
  assert.ok(exported.positions[highDegree.id], `Position for ${highDegree.id}; nodes ${exported.nodes.length}, positions ${Object.keys(exported.positions).length}`);
  await page.locator('[data-sna-canvas]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  let box = await page.locator('[data-sna-canvas]').boundingBox(), position = exported.positions[highDegree.id].rendered;
  await page.mouse.click(box.x + position.x, box.y + position.y);
  await page.locator('[data-sna-expand]').waitFor({ timeout: 3000 }).catch(async error => { console.log('Click failure', { errors, node: highDegree.id, box, position, drawer: await page.locator('[data-sna-drawer] h2').textContent() }); throw error; });
  await page.mouse.dblclick(box.x + position.x, box.y + position.y, { delay: 100 });
  const expanded = await json(); assert.ok(expanded.nodes.length > exported.nodes.length, 'Double click reveals hidden neighbours');
  await page.locator('[data-sna-prune]').click(); assert.ok((await json()).nodes.length < expanded.nodes.length);
  await page.locator('[data-sna-preset="backbone"]').click();
  await page.locator('.sna-filters > summary').click();
  await page.locator('[data-sna-filters] [data-advanced] > summary').click();
  await page.locator('[data-facet="party"] > summary').click();
  await page.locator('[data-facet="party"] [data-selection="include"][value="kok"]').check();
  const included = await json(), map = new Map(included.nodes.map(node => [node.id, node]));
  assert.ok(included.edges.every(edge => map.get(edge.target).party === 'kok'));
  assert.ok((await page.locator('[data-sna-records]').innerText()).includes('KOK'));
  const hash = page.url(); await page.reload(); await page.locator('[data-sna-canvas] canvas').first().waitFor();
  assert.equal(page.url(), hash); assert.deepEqual((await json()).filters.facets.party.include, ['kok']);
  await page.locator('[data-sna-weight]').focus(); await page.keyboard.press('End'); await page.keyboard.press('ArrowRight');
  assert.ok((await json()).edges.every(edge => edge.weight >= Number((new URL(page.url()).hash.match(/min=([^&]+)/) || [])[1] || 0)));
  await page.goto(`${url}/?view=full#/relationships`); await page.locator('[data-sna-canvas] canvas').first().waitFor();
  await page.locator('[data-sna-stage]').screenshot({ path: '.hermes-tmp.sna/desktop.png' });
  await page.locator('.theme-select').selectOption('dark'); await page.locator('[data-sna-stage]').screenshot({ path: '.hermes-tmp.sna/dark.png' });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const phone = await mobile.newPage(), mobileRequests = [];
  phone.on('pageerror', error => errors.push(error.message)); phone.on('request', request => mobileRequests.push(request.url()));
  await phone.goto(`${url}/?view=full#/relationships`); await phone.locator('[data-sna-records] .sna-ego-cards').waitFor();
  assert.equal(await phone.locator('[data-sna-stage]').isVisible(), false);
  assert.equal(mobileRequests.some(path => path.includes('cytoscape.esm') || path.includes('transparency-canvas.js')), false, 'Mobile avoids downloading the graph renderer until requested');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Mobile has no horizontal page overflow');
  await phone.locator('[data-sna-list="table"]').tap(); await phone.locator('[data-sna-records] .sna-table').waitFor();
  await phone.locator('[data-sna-list="cards"]').tap();
  await phone.locator('[data-sna-records] [data-sna-inspect-edge]').first().tap();
  await phone.locator('.sna-standalone-drawer .sna-disclosure').first().waitFor();
  await phone.locator('[data-sna-open]').tap(); await phone.locator('[data-sna-canvas] canvas').first().waitFor();
  assert.equal(await phone.locator('.sna-standalone-drawer').count(), 0);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await phone.locator('[data-sna-open]').tap(); assert.equal(await phone.locator('[data-sna-stage]').isVisible(), false);
  await phone.locator('[data-sna-close]').tap(); assert.equal(await phone.locator('.sna-standalone-drawer').count(), 0);
  await phone.goto(`${url}/?view=simple#/relationships`); await phone.locator('[data-sna-records] .sna-ego-cards article').first().waitFor();
  assert.equal(await phone.locator('[data-sna-stage]').isVisible(), false);
  await phone.screenshot({ path: '.hermes-tmp.sna/mobile.png', fullPage: false });
  await phone.addScriptTag({ content: axeSource });
  const mobileAudit = await phone.evaluate(() => axe.run(document.querySelector('[data-sna-page]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
  assert.deepEqual(mobileAudit.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], 'Mobile accessibility');
  await mobile.close(); await context.close(); assert.deepEqual(errors, []);
  console.log('Browser verification passed: presets, evidence, layouts, themes, exports, paths, expansion/pruning, synchronized filters, URL state, mobile/easy mode and WCAG checks.');
} finally { await browser.close(); server?.kill(); }
