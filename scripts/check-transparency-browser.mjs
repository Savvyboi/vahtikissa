import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { unpackTransparencyGraph } from '../transparency-model.js';

const require = createRequire(import.meta.url), port = process.env.TRANSPARENCY_TEST_PORT || '4215', url = process.env.BROWSER_TEST_URL || `http://localhost:${port}`;
const server = process.env.BROWSER_TEST_URL ? null : spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: port }, stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const errors = [];
const localManifest = JSON.parse(await readFile(new URL('../data/networks/transparency.json', import.meta.url), 'utf8'));
const localGraph = unpackTransparencyGraph(JSON.parse(await readFile(new URL(`../data/networks/${localManifest.graphFile}`, import.meta.url), 'utf8')));
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
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
  assert.equal(new URL(page.url()).hash, '#/relationships', 'Default navigation keeps the primary route stable');
  async function download(format) {
    const wait = page.waitForEvent('download'); await page.locator('[data-sna-export]').selectOption(format);
    const result = await wait; return readFile(await result.path());
  }
  const json = async () => JSON.parse(await download('json'));
  const audit = async (target, label) => {
    if (!await target.evaluate(() => !!globalThis.axe)) await target.addScriptTag({ content: axeSource });
    const result = await target.evaluate(() => axe.run(document.querySelector('[data-sna-page]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    assert.deepEqual(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], label);
  };
  let exported = await json();
  assert.ok(exported.nodes.length > 0 && exported.nodes.length <= 100);
  assert.ok(exported.edges.length > 0 && exported.edges.length <= 200);
  assert.equal(Object.keys(exported.positions).length, exported.nodes.length);
  assert.equal(exported.snapshotId.length, 24);
  for (const preset of ['backbone', 'dual', 'brokers', 'interlocks', 'bills']) {
    await page.locator(`[data-sna-preset="${preset}"]`).click(); exported = await json();
    assert.equal(exported.preset, preset); assert.ok(exported.edges.length > 0, `${preset} has visible connections`);
    if (preset === 'dual') assert.ok(exported.edges.every(edge => edge.isDualRole));
    if (preset === 'brokers') assert.ok(exported.nodes.length <= 60);
    if (preset === 'interlocks') assert.ok(exported.edges.every(edge => edge.isCrossBloc && edge.sharedOrgs.length));
    if (preset === 'bills') assert.ok(exported.nodes.some(node => node.type === 'bill'));
    for (const mode of ['columns', 'rings', 'force']) {
      await page.locator('[data-sna-layout]').selectOption(mode);
      assert.ok((await page.locator('[data-sna-map-count]').textContent()).trim(), `${preset}/${mode} renders`);
    }
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
    await audit(page, `Desktop ${theme} accessibility with evidence open`);
  }
  const png = await download('png'); assert.equal(png.subarray(1, 4).toString(), 'PNG');
  await page.locator('.theme-select').selectOption('light');
  await page.locator('[data-sna-preset="backbone"]').click();
  exported = await json();
  const firstEdge = exported.edges[0], a = exported.nodes.find(node => node.id === firstEdge.source), b = exported.nodes.find(node => node.id === firstEdge.target);
  await page.locator('#sna-path-a').fill(a.name); await page.locator('#sna-path-b').fill(b.name); await page.locator('[data-sna-path] button[type="submit"]').click();
  assert.ok((await page.locator('[data-sna-path-status]').textContent()).includes('→'));
  assert.equal((await json()).appearance.path.edges.length, 1);
  await page.locator('[data-sna-clear-path]').click();
  const adjacent = new Map(exported.nodes.map(node => [node.id, []]));
  for (const edge of exported.edges) { adjacent.get(edge.source).push(edge.target); adjacent.get(edge.target).push(edge.source); }
  let fourHops;
  for (const start of exported.nodes) {
    const queue = [[start.id]], seen = new Set([start.id]);
    for (let i = 0; i < queue.length && !fourHops; i++) {
      const path = queue[i];
      if (path.length === 5) { fourHops = path; break; }
      for (const id of adjacent.get(path.at(-1))) if (!seen.has(id)) { seen.add(id); queue.push([...path, id]); }
    }
    if (fourHops) break;
  }
  assert.ok(fourHops, 'The source backbone exercises a real shortest four-hop path');
  await page.locator('#sna-path-a').fill(exported.nodes.find(node => node.id === fourHops[0]).name);
  await page.locator('#sna-path-b').fill(exported.nodes.find(node => node.id === fourHops[4]).name);
  await page.locator('[data-sna-path] button[type="submit"]').click();
  assert.equal((await json()).appearance.path.edges.length, 4);
  await page.locator('[data-sna-clear-path]').click();
  await page.locator('[data-sna-canvas]').focus();
  const beforePan = (await json()).appearance.viewport;
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('+');
  const afterPan = (await json()).appearance.viewport;
  assert.notEqual(afterPan.pan.x, beforePan.pan.x); assert.ok(afterPan.zoom > beforePan.zoom);
  await page.keyboard.press('Control+ArrowRight');
  assert.deepEqual((await json()).appearance.viewport, afterPan, 'Map shortcuts leave modified browser commands alone');
  await page.keyboard.press('f');
  exported = await json();
  // Select and expand an actual rendered node using the exported viewport coordinates.
  const highDegree = exported.nodes.filter(node => node.type === 'mp').sort((a, b) => b.degree - a.degree)[0];
  assert.ok(exported.positions[highDegree.id], `Position for ${highDegree.id}; nodes ${exported.nodes.length}, positions ${Object.keys(exported.positions).length}`);
  await page.locator('[data-sna-canvas]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  let box = await page.locator('[data-sna-canvas]').boundingBox(), position = exported.positions[highDegree.id].rendered;
  await page.mouse.click(box.x + position.x, box.y + position.y);
  await page.locator('[data-sna-expand]').waitFor({ timeout: 3000 }).catch(async error => { console.log('Click failure', { errors, node: highDegree.id, box, position, drawer: await page.locator('[data-sna-drawer] h2').textContent() }); throw error; });
  // Keep the inspection click separate from the next double-click gesture.
  // Cytoscape's 250ms multi-click window would otherwise treat these three
  // clicks as overlapping double taps and refit the map mid-gesture.
  await page.waitForTimeout(350);
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
  // Compare a compound filter with a separate calculation over the source
  // descriptors. Do not use the frontend's filtering implementation as oracle.
  const facets = { party: { include: ['kok', 'sd'], exclude: ['sd'] }, year: { include: ['2024'], exclude: ['2025'] }, layer: { include: ['sidonnaisuus', 'lahja'], exclude: ['lobbaus'] } };
  const nodes = new Map(localGraph.nodes.map(node => [node.id, node]));
  const expected = localGraph.edges.flatMap(edge => {
    if (nodes.get(edge.target).party !== 'kok') return [];
    const details = edge.details.filter(detail => !detail.inferred && detail.periods.includes('2024') && !detail.periods.includes('2025'));
    const counts = Object.fromEntries(['sidonnaisuus', 'lobbaus', 'lahja'].map(layer => [layer, new Set(details.filter(detail => detail.layer === layer).map(detail => detail.id)).size]));
    if (counts.lobbaus || !counts.sidonnaisuus && !counts.lahja) return [];
    return [{ ...edge, counts, weight: +(3 * counts.sidonnaisuus + 2.5 * counts.lahja).toFixed(2) }];
  }).sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  await page.goto(`${url}/?view=full#/relationships?${new URLSearchParams({ facets: JSON.stringify(facets), inferred: '0' })}`);
  await page.locator('[data-sna-canvas] canvas').first().waitFor();
  const compound = await json(); assert.ok(expected.length, 'Compound filter has real source support');
  for (const edge of compound.edges) { const source = expected.find(row => row.id === edge.id); assert.ok(source); assert.deepEqual(edge.counts, source.counts); assert.equal(edge.weight, source.weight); }
  assert.match(await page.locator('[data-sna-status]').textContent(), new RegExp(`^${expected.length} `));
  assert.deepEqual(await page.locator('[data-sna-records] tbody tr td:nth-child(4)').allTextContents(), expected.slice(0, 25).map(edge => edge.weight.toLocaleString('fi-FI', { maximumFractionDigits: 2 })));
  await page.locator('.sna-heatmap > summary').click();
  const expectedHeat = new Map(); for (const edge of expected) expectedHeat.set(edge.source, (expectedHeat.get(edge.source) || 0) + 1);
  for (const row of await page.locator('[data-sna-heatmap] tbody tr').all()) {
    const id = await row.locator('[data-sna-inspect-node]').getAttribute('data-sna-inspect-node');
    assert.equal(Number(await row.locator('td').first().textContent()), expectedHeat.get(id));
  }
  // Missing amounts must remain missing in human-readable evidence too.
  const unknownGift = localGraph.edges.find(edge => edge.details.some(detail => detail.id === 'lahja:1412-2023-18'));
  await page.goto(`${url}/?view=full#/relationships?q=${encodeURIComponent(nodes.get(unknownGift.source).name)}`);
  await page.locator(`[data-sna-records] [data-sna-inspect-edge="${unknownGift.id}"]`).click();
  assert.equal(await page.locator('[data-sna-drawer] h2').evaluate(element => element === document.activeElement), true, 'Inspecting moves keyboard focus to the evidence heading');
  const giftEvidence = page.locator('.sna-disclosure').filter({ hasText: '1412-2023-18' });
  await giftEvidence.locator('summary').click();
  assert.match(await giftEvidence.innerText(), /Arvoa ei ilmoitettu/);
  await page.keyboard.press('Tab'); assert.ok(await page.locator('[data-sna-drawer] :focus').count(), 'Evidence actions remain in the drawer');
  await page.locator('[data-sna-close]').click(); assert.equal(await page.locator(`[data-sna-records] [data-sna-inspect-edge="${unknownGift.id}"]`).evaluate(element => element === document.activeElement), true);
  const availableBill = localGraph.bills.find(bill => bill.available);
  const openBillEvidence = async () => {
    await page.goto(`${url}/?view=full#/relationships?q=${encodeURIComponent(availableBill.heId)}`);
    await page.locator('[data-sna-records] [data-sna-inspect-edge]').first().click();
    await page.locator('[data-sna-evidence] .sna-disclosure').first().waitFor();
  };
  await openBillEvidence();
  await page.locator(`[data-sna-drawer] a[href="#/legislation/${encodeURIComponent(availableBill.heId)}"]`).click();
  await page.locator('.legislation-detail .matter-summary').waitFor();
  assert.ok((await page.locator('main').innerText()).includes(availableBill.heId), 'The evidence link opens the actual stored bill');
  await openBillEvidence();
  const speechQuery = availableBill.heId.replace(/ vp$/u, '');
  await page.locator(`[data-sna-drawer] a[href="#/speeches?${new URLSearchParams({ q: speechQuery })}"]`).click();
  await page.locator('.speech-filters [data-filter]').waitFor({ state: 'attached' });
  const speechPanel = page.locator('details.filter-panel:has(.speech-filters)');
  if (await speechPanel.count() && !await speechPanel.evaluate(element => element.open)) await speechPanel.locator(':scope > summary').click();
  await page.locator('.speech-filters [data-filter]').waitFor();
  assert.equal(await page.locator('.speech-filters [data-filter]').inputValue(), speechQuery, 'The speech link retains the exact HE query');
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
  assert.equal(await phone.locator('.sna-table thead').evaluate(element => getComputedStyle(element).position), 'static', 'Optional mobile tables retain visible column headings');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Optional mobile table scrolls within the page');
  await phone.locator('.sna-heatmap > summary').tap();
  assert.equal(await phone.locator('[data-sna-heatmap] thead').evaluate(element => getComputedStyle(element).position), 'static', 'Mobile heatmap keeps party headings');
  assert.equal(await phone.locator('[data-sna-heatmap] tbody tr').first().evaluate(element => getComputedStyle(element).display), 'table-row');
  await phone.locator('[data-sna-heatmap]').screenshot({ path: '.hermes-tmp.sna/mobile-heatmap.png' });
  await audit(phone, 'Mobile optional table and heatmap accessibility');
  await phone.locator('.sna-heatmap > summary').tap();
  await phone.locator('[data-sna-list="cards"]').tap();
  await phone.locator('[data-sna-records] [data-sna-inspect-edge]').first().tap();
  await phone.locator('.sna-standalone-drawer .sna-disclosure').first().waitFor();
  assert.equal(await phone.locator('.sna-standalone-drawer h2').evaluate(element => element === document.activeElement), true, 'Card-only evidence moves focus after leaving the hidden stage');
  await phone.locator('[data-sna-open]').tap(); await phone.locator('[data-sna-canvas] canvas').first().waitFor();
  assert.equal(await phone.locator('.sna-standalone-drawer').count(), 0);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await phone.locator('[data-sna-open]').tap(); assert.equal(await phone.locator('[data-sna-stage]').isVisible(), false);
  await phone.locator('[data-sna-close]').tap(); assert.equal(await phone.locator('.sna-standalone-drawer').count(), 0);
  await phone.goto(`${url}/?view=simple#/relationships`); await phone.locator('[data-sna-records] .sna-ego-cards article').first().waitFor();
  assert.equal(await phone.locator('[data-sna-stage]').isVisible(), false);
  await phone.screenshot({ path: '.hermes-tmp.sna/mobile.png', fullPage: false });
  for (const width of [320, 390]) {
    await phone.setViewportSize({ width, height: 844 });
    for (const view of ['full', 'simple']) {
      await phone.goto(`${url}/?view=${view}#/relationships`); await phone.locator('[data-sna-records] .sna-ego-cards article').first().waitFor();
      for (const lang of ['fi', 'sv', 'en']) {
        await phone.locator('.language-select').selectOption(lang); await phone.locator('[data-sna-page]').waitFor();
        for (const theme of ['light', 'dark', 'contrast']) {
          await phone.locator('.theme-select').selectOption(theme);
          assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}/${view}/${lang}/${theme}: no page overflow`);
          await audit(phone, `${width}/${view}/${lang}/${theme}: accessibility`);
        }
      }
    }
  }
  // A damaged graph is rejected; retry recovers without a full page reload.
  const failureContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const failure = await failureContext.newPage();
  await failure.route('**/transparency-*/graph.json', route => route.fulfill({ body: '{"snapshotId":"damaged"}', contentType: 'application/json' }));
  await failure.goto(`${url}/?view=full#/relationships`); await failure.locator('[data-sna-retry]').waitFor();
  assert.match(await failure.locator('[role="alert"]').innerText(), /Aineistoa ei voitu ladata/);
  await failure.unroute('**/transparency-*/graph.json'); await failure.locator('[data-sna-retry]').click();
  await failure.locator('[data-sna-records] .sna-ego-cards article').first().waitFor();
  await failure.route('**/transparency-*/evidence.json', route => route.fulfill({ body: '{}', contentType: 'application/json' }));
  await failure.locator('[data-sna-records] [data-sna-inspect-edge]').first().click();
  await failure.waitForFunction(() => document.querySelector('[data-sna-evidence]')?.textContent.includes('ei voitu ladata'));
  await failure.unroute('**/transparency-*/evidence.json'); await failure.locator('[data-sna-records] [data-sna-inspect-edge]').first().click();
  await failure.locator('.sna-disclosure').first().waitFor();
  await failureContext.close();
  await mobile.close(); await context.close(); assert.deepEqual(errors, []);
  console.log('Browser verification passed: presets, evidence, layouts, themes, exports, paths, expansion/pruning, synchronized filters, URL state, mobile/easy mode and WCAG checks.');
} finally { await browser.close(); server?.kill(); }
