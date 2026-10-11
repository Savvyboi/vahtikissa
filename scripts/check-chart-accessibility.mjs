import { openFilterPanels } from './browser-filter-checks.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const parliament = JSON.parse(await readFile(new URL('../data/parliament.json', import.meta.url), 'utf8'));
const election = JSON.parse(await readFile(new URL('../data/elections-2023.json', import.meta.url), 'utf8'));
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const parties = [...css.matchAll(/\.speech-party-([a-z]+)\{--speech-accent:/g)].map(match => match[1]);
const port = process.env.CHART_TEST_PORT || '4189';
const url = process.env.BROWSER_TEST_URL || `http://localhost:${port}`;
const server = process.env.BROWSER_TEST_URL ? null : spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: port }, stdio: 'ignore', windowsHide: true
});
let browser;
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url);
  await page.locator('main[aria-busy="false"] h1').waitFor();
  async function navigate(route) {
    await page.evaluate(route => { location.hash = '#/' + route; }, route);
    await page.waitForFunction(route => {
      const main = document.querySelector('main');
      return main?.dataset.route === '#/' + route && main.getAttribute('aria-busy') === 'false' && main.querySelector('h1');
    }, route);
  }
  async function assertElectionTable(expected) {
    await page.locator('.election-data-table > summary').click();
    const rows = await page.locator('.election-data-table tbody tr').evaluateAll(rows => rows.map(row => [...row.cells].map(cell => cell.textContent.trim())));
    assert.equal(rows.length, expected.length);
    const sorted = [...expected].sort((a, b) => b.votes - a.votes);
    for (let index = 0; index < rows.length; index++) {
      assert.deepEqual(rows[index], [sorted[index].name.fi,
        new Intl.NumberFormat('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(sorted[index].share) + ' %',
        new Intl.NumberFormat('fi-FI').format(sorted[index].votes), new Intl.NumberFormat('fi-FI').format(sorted[index].seats)]);
    }
    assert.equal(await page.locator('.election-bars [role="listitem"]').count(), rows.length);
    assert.equal(await page.locator('.election-track:not([aria-hidden="true"]), .party-swatch:not([aria-hidden="true"])').count(), 0);
  }
  await navigate('elections');
  await assertElectionTable(election.parties);
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const electionViolations = await page.evaluate(async () => (await axe.run(document.querySelector('.election-page'))).violations);
  assert.deepEqual(electionViolations, [], 'The complete election page must have valid accessible chart semantics');
  const district = election.districts[0];
  await openFilterPanels(page);
  await page.locator('[data-election-district]').selectOption(district.code);
  await assertElectionTable(election.districtResults.filter(item => item.locationCode === district.code).map(item => ({
    name: item.party, votes: item.votes, share: item.share,
    seats: election.candidates.filter(candidate => candidate.districtCode === district.code && candidate.partyCode === item.partyCode).length
  })));
  assert.match(await page.locator('.election-data-table caption').innerText(), new RegExp(district.name.fi.replace(/^VP\d+\s*/, '')));
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const tableViolations = await page.evaluate(async () => (await axe.run(document.querySelector('.election-data-table'))).violations);
  assert.deepEqual(tableViolations, [], 'The expanded election table must remain accessible on phones');
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const item of [parliament.legislation.find(item => !item.decision), parliament.legislation.find(item => item.decision)].filter(Boolean)) {
    await navigate('legislation/' + encodeURIComponent(item.id));
    const timeline = page.locator('.legislation-timeline');
    assert.equal(await timeline.getAttribute('role'), 'list');
    assert.equal(await timeline.locator('li[aria-current="step"]').count(), 1);
    for (const text of await timeline.locator('li .sr-only').allTextContents()) assert.match(text, /^(Aiempi|Nykyinen|Myöhempi) vaihe:/);
  }
  await navigate('votes/' + encodeURIComponent(parliament.votes[0].id));
  const voteLabel = await page.locator('.result-block .result').getAttribute('aria-label');
  for (const choice of ['yes', 'no', 'abstain', 'absent']) assert.ok(voteLabel.includes(String(parliament.votes[0][choice])));
  await page.evaluate(parties => {
    const probes = document.createElement('section');
    probes.id = 'party-contrast-probes';
    probes.setAttribute('aria-label', 'Party badge contrast probes');
    probes.innerHTML = parties.map(party => `<article class="speech speech-party-${party}"><span class="speech-party" data-party="${party}">${party}</span></article>`).join('');
    document.body.append(probes);
  }, parties);
  const minimums = {};
  for (const theme of ['light', 'dark', 'contrast']) {
    await page.locator('.theme-select').selectOption(theme);
    const results = await page.locator('#party-contrast-probes .speech-party').evaluateAll(badges => {
      const luminance = color => {
        const rgb = color.match(/[\d.]+/g).slice(0, 3).map(value => Number(value) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      return badges.map(badge => {
        const style = getComputedStyle(badge), foreground = luminance(style.color), background = luminance(style.backgroundColor);
        return { party: badge.dataset.party, ratio: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) };
      });
    });
    assert.equal(results.length, parties.length);
    for (const result of results) assert.ok(result.ratio >= 4.5, `${theme} / ${result.party}: ${result.ratio.toFixed(2)}:1 is below WCAG AA`);
    minimums[theme] = Math.min(...results.map(result => result.ratio)).toFixed(2);
  }
  await page.evaluate(() => document.querySelector('#party-contrast-probes').remove());
  console.log(`Election alternatives, timeline states and ${parties.length} party badge palettes passed. Minimum contrast: ${JSON.stringify(minimums)}`);
} finally {
  await browser?.close();
  server?.kill();
}