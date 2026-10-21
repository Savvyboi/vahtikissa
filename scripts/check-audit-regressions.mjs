import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const readJSON = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const [data, budget, influence] = await Promise.all([
  readJSON('data/parliament.json'), readJSON('data/budget.json'), readJSON('data/influence.json')
]);
const port = process.env.AUDIT_TEST_PORT || '4204';
const url = process.env.BROWSER_TEST_URL || 'http://localhost:' + port;
const server = process.env.BROWSER_TEST_URL ? null : spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: port }, stdio: 'ignore', windowsHide: true
});
const output = new URL('../.hermes-tmp.audit/', import.meta.url);
const failures = [];
let browser, sequence = 0;

// Fixtures come from the published snapshot, so changed names, dates and file shards
// do not silently turn these checks into tests of records which no longer exist.
const fullName = member => (member.firstName + ' ' + member.lastName).trim();
const member = data.members.find(item => item.firstName && item.lastName);
const interestNames = new Set((influence.interests || []).map(item => item.mpName));
const focusedMember = data.members.find(item => interestNames.has(fullName(item)));
assert.ok(member && focusedMember, 'The snapshot contains searchable MPs with disclosure records');
const focusedName = fullName(focusedMember);
const focusedInterests = influence.interests.filter(item => item.mpName === focusedName);
const differentInterestName = [...interestNames].find(name => name !== focusedName);
assert.ok(differentInterestName, 'A second MP is available to establish an incompatible saved filter');
const speech = data.speeches.find(item => Number.isInteger(item.textChunk));
assert.ok(speech, 'A speech references a published transcript shard');
const speechTexts = await readJSON('data/speech-texts-' + speech.textChunk + '.json');
const speechText = speechTexts[speech.id];
assert.ok(speechText, 'The transcript fixture exists in its actual shard');
const word = speechText.match(/\p{L}{4,}/u)?.[0];
assert.ok(word, 'The transcript contains a searchable word');
const speechId = id => 'speech-' + String(id).replace(/[^\p{L}\p{N}_-]+/gu, '-');
const pathFor = (page, id) => page + '/' + encodeURIComponent(id);
const stripSpace = value => String(value).replace(/\s+/gu, '');
const normalize = value => String(value).replace(/\s+/gu, ' ').trim();
const money = value => {
  const formatter = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: Math.abs(value) >= 1e6 ? 1 : 0 });
  return Math.abs(value) >= 1e9 ? formatter.format(value / 1e9) + ' mrd. €'
    : Math.abs(value) >= 1e6 ? formatter.format(value / 1e6) + ' milj. €'
    : formatter.format(value) + ' €';
};
function walk(items, parents = []) {
  return (items || []).flatMap(item => [{ item, path: [...parents, item.code] }, ...walk(item.children, [...parents, item.code])]);
}
const borrowingYear = [...budget.years].reverse().find(year => {
  const entries = walk(year.income).map(entry => entry.item);
  const loan = entries.find(item => item.code === '150301');
  const finance = entries.find(item => item.code === '15');
  return loan && finance && loan.budget !== finance.budget;
});
assert.ok(borrowingYear, 'A published year distinguishes net borrowing from other financial income');
const budgetLeaf = walk(budget.years.at(-1).expense).find(({ item, path }) => path.length >= 3 && !item.children?.length);
assert.ok(budgetLeaf, 'The budget has a leaf which can be opened directly');
const leafRoute = ['budget', budget.years.at(-1).year, 'expense', ...budgetLeaf.path].join('/');

async function ready(page, route, view = 'full') {
  await page.waitForFunction(({ route, view }) => {
    const main = document.querySelector('main');
    return main?.dataset.route === '#/' + route && main.dataset.view === view
      && main.getAttribute('aria-busy') === 'false' && main.querySelector('h1');
  }, { route, view });
}
async function visit(page, route, view = 'full') {
  await page.goto(url + '/?view=' + view + '#/' + route, { waitUntil: 'domcontentloaded' });
  await ready(page, route, view);
}
async function navigate(page, route, view = 'full') {
  await page.evaluate(route => { location.hash = '#/' + route; }, route);
  await ready(page, route, view);
}
async function reveal(control) {
  await control.evaluate(element => {
    const parents = [];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parents.unshift(parent);
    }
    for (const parent of parents) if (!parent.open) parent.querySelector(':scope > summary').click();
  });
  await control.waitFor({ state: 'visible' });
  return control;
}
async function control(page, selector) {
  return reveal(page.locator(selector).first());
}
async function fitsViewport(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label + ' has no horizontal overflow');
}
async function check(label, run, width = 1440) {
  const number = ++sequence;
  const context = await browser.newContext({
    viewport: { width, height: width <= 600 ? 844 : 1000 },
    hasTouch: width <= 600, isMobile: width <= 600, reducedMotion: 'reduce'
  });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.stack || error.message));
  // External fonts are optional; every data request in this audit is served locally.
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  try {
    await run(page, context);
    assert.deepEqual(errors, [], label + ' has no uncaught browser errors');
    console.log('PASS ' + label);
  } catch (error) {
    failures.push({ label, error: error.stack || String(error), browserErrors: errors });
    console.error('FAIL ' + label + '\n' + (error.stack || error));
    await page.screenshot({ path: fileURLToPath(new URL(number + '.png', output)), fullPage: false }).catch(() => {});
  } finally { await context.close(); }
}

try {
  await mkdir(output, { recursive: true });
  let listening = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(url)).ok) { listening = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(listening, 'The local test server starts');
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });

  await check('Budget totals use the actual net borrowing moment', async page => {
    const year = borrowingYear, entries = walk(year.income).map(entry => entry.item);
    const loan = entries.find(item => item.code === '150301');
    await visit(page, 'budget/' + year.year + '/expense');
    for (const metric of ['budget', 'original', 'actual']) {
      const income = year.income.reduce((sum, item) => sum + Number(item[metric] || 0), 0);
      const expense = year.expense.reduce((sum, item) => sum + Number(item[metric] || 0), 0);
      const borrowed = Number(loan[metric] || 0);
      await page.locator('[data-budget-metric="' + metric + '"]').click();
      const values = await page.locator('.budget-overview > div > strong').allTextContents();
      assert.deepEqual(values.map(stripSpace), [expense, income - borrowed, borrowed, income - borrowed - expense].map(value => stripSpace(money(value))), metric + ' uses net state borrowing, preserving other financial income');
    }
  });

  await check('Explicit reading-mode history restores renderer and URL together', async page => {
    // The mode switch deliberately replaces its current history entry. Create
    // different route entries before switching so Back/Forward cross modes.
    await visit(page, 'members');
    await navigate(page, 'votes');
    await page.locator('.view-toggle').click();
    await ready(page, 'votes', 'simple');
    await navigate(page, 'members', 'simple');
    await page.locator('.view-toggle').click();
    await ready(page, 'members', 'full');
    for (const [route, view] of [['votes', 'simple'], ['members', 'full']]) {
      await page.goBack();
      await ready(page, route, view);
      assert.equal(new URL(page.url()).searchParams.get('view'), view);
      assert.equal(await page.locator('.easy-page').count() > 0, view === 'simple');
    }
    for (const [route, view] of [['votes', 'simple'], ['members', 'full']]) {
      await page.goForward();
      await ready(page, route, view);
      assert.equal(new URL(page.url()).searchParams.get('view'), view);
      assert.equal(await page.locator('.easy-page').count() > 0, view === 'simple');
    }
  });

  await check('Simple legislation party filtering uses recorded linked votes', async page => {
    const ballots = data.ballots.map(item => Array.isArray(item) ? { voteId: item[0], party: item[2] } : item);
    const party = ballots.find(item => item.party)?.party;
    const votes = new Set(ballots.filter(item => item.party === party).map(item => item.voteId));
    const expected = data.legislation.filter(item => item.voteIds.some(id => votes.has(id)));
    assert.ok(expected.length, 'The chosen party has recorded votes on parliamentary matters');
    await visit(page, 'legislation', 'simple');
    await (await control(page, '[data-easy-filter="party"]')).selectOption(party);
    const count = stripSpace(await page.locator('[data-easy-count]').innerText());
    assert.ok(count.endsWith('/' + expected.length + 'tulosta'), 'The full filtered total agrees with the published ballot relationships: ' + count);
    const allowed = new Set(expected.map(item => '#/' + pathFor('legislation', item.id)));
    const links = await page.locator('[data-easy-results] h3 a').evaluateAll(links => links.map(link => link.getAttribute('href')));
    assert.ok(links.length && links.every(link => allowed.has(link)), 'Every rendered result has a linked vote for that party');
  });

  await check('Detailed and global MP search accept a complete name', async page => {
    await visit(page, 'members');
    await (await control(page, '[data-member-query]')).fill(fullName(member));
    const href = '#/' + pathFor('members', member.id);
    await page.locator('[data-list] a.row-link[href="' + href + '"]').waitFor();
    assert.equal(await page.locator('[data-list] tbody tr').count(), 1);
    await page.locator('.search-button').click();
    await page.locator('#global-search').fill(fullName(member).replace(' ', '   '));
    await page.locator('.search-results a[href="' + href + '"]').waitFor();
    assert.equal(await page.locator('#global-search').evaluate(element => element === document.activeElement), true);
  });

  await check('Focused MP disclosures clear incompatible quick and advanced filters', async page => {
    await visit(page, 'influence');
    await page.locator('[data-influence-tab="interests"]').click();
    const other = await control(page, '[data-collection="influence"] [data-facet="mp"] [data-selection="include"][value=' + JSON.stringify(differentInterestName) + ']');
    await other.check();
    await page.locator('[data-influence-tab="lobbying"]').click();
    const category = await control(page, '[data-influence-filter="category"]');
    const chosenCategory = await category.locator('option').evaluateAll(options => options.find(option => option.value !== 'all').value);
    await category.selectOption(chosenCategory);
    const actor = await control(page, '[data-collection="influence"] [data-facet="actor"] [data-selection="include"]');
    await actor.check();
    await navigate(page, pathFor('influence', focusedMember.id));
    assert.equal(await page.locator('[data-influence-filter="mp"]').inputValue(), focusedName);
    assert.equal(await page.locator('.interest-card').count(), Math.min(100, focusedInterests.length));
    assert.ok((await page.locator('.interest-card h2').allTextContents()).every(name => name === focusedName));
    const count = stripSpace(await page.locator('.filter-actions .filter-summary').innerText());
    assert.ok(count.startsWith(String(focusedInterests.length)), 'All of this MP’s disclosure records remain available');
  });

  await check('Failed focused disclosures Retry retains the requested MP', async page => {
    let requests = 0;
    await page.route('**/data/influence.json', route => ++requests === 1 ? route.abort('failed') : route.continue());
    await visit(page, pathFor('influence', focusedMember.id));
    await page.locator('.load-error [data-retry]').click();
    await page.locator('.influence-page').waitFor();
    assert.equal(requests, 2);
    assert.equal(await page.locator('[data-influence-filter="mp"]').inputValue(), focusedName);
    assert.equal(await page.locator('.interest-card').count(), Math.min(100, focusedInterests.length));
    assert.ok((await page.locator('.interest-card h2').allTextContents()).every(name => name === focusedName));
    assert.equal(await page.locator('.load-error').count(), 0);
  });

  await check('Sorted and filtered speech search links still reveal their exact target', async page => {
    const firstBySurname = new Map();
    data.speeches.forEach((item, index) => { if (!firstBySurname.has(item.lastName)) firstBySurname.set(item.lastName, { item, index }); });
    const target = [...firstBySurname.values()].find(({ item, index }) => index >= 40 && item.lastName && String(item.mpId) !== String(speech.mpId))?.item;
    assert.ok(target, 'An MP’s first search result lies beyond the first raw speech page');
    await visit(page, 'speeches');
    await (await control(page, '[data-collection="speeches"] [data-tool="direction"]')).selectOption('asc');
    await (await control(page, '[data-speech-member]')).selectOption(String(speech.mpId));
    await navigate(page, 'overview');
    await page.locator('.search-button').click();
    await page.locator('#global-search').fill(target.lastName);
    const href = '#/' + pathFor('speeches', target.id);
    await page.locator('.search-results a[href="' + href + '"]').click();
    await ready(page, pathFor('speeches', target.id));
    const article = page.locator('[id=' + JSON.stringify(speechId(target.id)) + ']');
    await article.waitFor();
    assert.equal(await article.locator('time').getAttribute('datetime'), target.date);
    assert.equal(await article.locator('.speech-speaker').getAttribute('href'), '#/' + pathFor('members', target.mpId));
  });

  for (const route of [pathFor('speeches', speech.id), pathFor('members', speech.mpId)]) {
    await check('Transcript failure and Retry recover in ' + route.split('/')[0], async page => {
      const pattern = '**/data/speech-texts-*.json';
      await page.route(pattern, route => route.abort('failed'));
      await visit(page, route);
      const retry = page.locator('[data-speech-retry]').first();
      await retry.waitFor();
      const article = retry.locator('xpath=ancestor::article');
      const articleId = await article.getAttribute('id');
      assert.equal(articleId, speechId(await retry.getAttribute('data-speech-id')), 'Retry identifies the containing speech');
      assert.ok(await article.locator('[role="alert"]').isVisible(), 'Failed transcripts explain the problem');
      await retry.click();
      await retry.waitFor();
      assert.equal(await retry.evaluate(element => element === document.activeElement), true, 'A failed retry keeps its actionable button focused');
      await page.unroute(pattern);
      await retry.click();
      const restored = page.locator('[id=' + JSON.stringify(articleId) + ']');
      await restored.locator('.speech-text p').first().waitFor();
      assert.equal(await restored.locator('[data-speech-retry]').count(), 0);
      const fixture = data.speeches.find(item => speechId(item.id) === articleId);
      assert.ok(fixture, 'The recovered card identifies a published speech');
      const transcript = await readJSON('data/speech-texts-' + fixture.textChunk + '.json');
      assert.ok(normalize(await restored.locator('.speech-text').innerText()).startsWith(normalize(transcript[fixture.id]).slice(0, 80)), 'Retry displays the actual full transcript for the same speech');
      assert.equal(await restored.evaluate(element => element === document.activeElement), true, 'Success restores focus to the recovered speech');
    });
  }

  await check('An unknown detailed vote is a usable 404 rather than a loading failure', async page => {
    await visit(page, 'votes/audit-missing-vote');
    assert.equal(await page.locator('.load-error').count(), 0);
    assert.match(await page.locator('main h1').innerText(), /Sivua ei löytynyt/);
    await page.locator('.brand').first().click();
    await ready(page, 'overview');
  });

  for (const width of [390, 320]) {
    await check('Direct budget leaf search remains open and focused at ' + width + 'px', async page => {
      await visit(page, leafRoute);
      const input = await control(page, '[data-budget-search]');
      const panel = input.locator('xpath=ancestor::details[@data-filter-panel]');
      await input.pressSequentially('asumis', { delay: 30 });
      assert.equal(await page.locator('[data-budget-search]').inputValue(), 'asumis', 'The complete multi-character query survives leaf-to-results redraws');
      assert.equal(await page.locator('[data-budget-search]').evaluate(element => element === document.activeElement), true);
      assert.equal(await panel.evaluate(element => element.open), true);
      await page.locator('[data-budget-clear-search]').click();
      assert.equal(await page.locator('[data-budget-search]').inputValue(), '');
      assert.equal(await panel.evaluate(element => element.open), true, 'Clearing the query returns to the leaf without closing search');
      assert.ok(await page.locator('.budget-item-metrics').isVisible());
      await fitsViewport(page, 'Budget leaf and search controls');
    }, width);

    await check('Monthly speech statistics retain visible field labels at ' + width + 'px', async page => {
      const params = new URLSearchParams({ q: word, scope: 'text', match: 'word' });
      await visit(page, 'speeches/?' + params);
      const table = page.locator('[data-research-summary] table');
      await table.locator('tbody tr').first().waitFor({ state: 'attached' });
      await table.locator('xpath=ancestor::details').locator(':scope > summary').click();
      const headers = await table.locator('thead th').allTextContents();
      assert.equal(headers.length, 6);
      const cells = table.locator('tbody tr').first().locator('td');
      assert.equal(await cells.count(), 6);
      for (let index = 0; index < headers.length; index++) {
        const cell = cells.nth(index);
        assert.equal(await cell.getAttribute('data-label'), headers[index]);
        const before = await cell.evaluate(element => getComputedStyle(element, '::before').content);
        assert.ok(before.includes(headers[index]), 'The visible mobile pseudo-label identifies ' + headers[index]);
      }
      await fitsViewport(page, 'Monthly speech statistics');
    }, width);

    await check('Participation explanations can be tapped at ' + width + 'px', async page => {
      await visit(page, 'members');
      const help = page.locator('.metric-help').first();
      await help.locator(':scope > summary').tap();
      const text = help.locator('.metric-help-text');
      await text.waitFor();
      assert.match(await text.innerText(), /Poissaolo.*äänestysparista/s);
      assert.equal(await help.evaluate(element => element.open), true);
      const box = await text.boundingBox();
      assert.ok(box.width > 100 && box.height > 20, 'The explanation has a readable visible area');
      await help.locator(':scope > summary').tap();
      assert.equal(await text.isVisible(), false);
      await fitsViewport(page, 'Participation explanation');
    }, width);
  }
  if (failures.length) throw new Error(JSON.stringify(failures, null, 2));
  console.log('All 12 audited bug regressions passed, including 390px and 320px touch layouts.');
} finally {
  await browser?.close();
  server?.kill();
}
