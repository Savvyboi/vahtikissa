import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { emptyInsights, sourceFingerprint } from '../ai-insights.js';

const require = createRequire(import.meta.url);
const port = process.env.FOLLOWING_TEST_PORT || '4217', origin = 'http://localhost:' + port;
const server = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: port }, stdio: 'ignore', windowsHide: true });
// A clean checkout has no ignored parliament/ shards until server startup builds them.
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Following browser test server did not become ready');
} catch (error) { server.kill(); throw error; }
const readJSON = async name => JSON.parse(await readFile(new URL('../data/' + name, import.meta.url), 'utf8'));
const [originalCore, originalMember, legislation, programmes, partyVotes] = await Promise.all([
  readJSON('parliament/core.json'), readJSON('parliament/member-0.json'), readJSON('parliament/legislation.json'), readJSON('programmes.json'), readJSON('parliament/party-votes.json')
]);
const mp = originalCore.members[0], mpId = String(mp.id), tagId = 'following-browser-theme';
const tag = { id: tagId, label: { fi: 'Seurannan testiteema', sv: 'Testtema för följning', en: 'Following test theme' }, quote: 'Browser verification fixture', promise: false };
const programme = programmes.parties[0].programmes[0];
const aiIndex = emptyInsights();
aiIndex.generatedAt = '2026-10-21T12:00:00Z';
aiIndex.programmes[programme.id] = { ...programme, party: programmes.parties[0].code, tags: [tag] };
for (const [kind, record] of [['votes', originalCore.votes[0]], ['legislation', legislation.legislation[0]]]) {
  aiIndex.records[kind][record.id] = { fingerprint: sourceFingerprint(kind, record), tags: [tagId], file: 'a'.repeat(64) + '.json' };
}
const influence = {
  metadata: { generatedAt: '2026-10-20T12:00:00Z', memberCoverage: originalCore.members.length, parliamentSource: 'https://api.eduskunta.fi/api/v1/reference-data/kansanedustajat', transparencySource: 'https://public.api.avoimuusrekisteri.fi/open-data-activity-notification' },
  gifts: [{ id: 'browser-gift', mpId, description: 'Browser gift source', reported: '01.01.2024', donor: 'Browser donor' }],
  targets: [{ id: 12345, kind: 'mp', fi: { name: mp.firstName + ' ' + mp.lastName } }],
  lobbying: [{ id: 'browser-lobbying', actor: 'Browser actor', topic: 'Browser lobbying source', targetIds: [12345], reported: '2024-01-01', period: { start: '2023-07-01', end: '2023-12-31' } }],
  interests: [], counts: { gifts: 1, lobbyingTopics: 1 }
};

function snapshot(generation) {
  const core = structuredClone(originalCore), member = structuredClone(originalMember);
  const stamp = '2026-10-' + String(20 + generation).padStart(2, '0') + 'T16:41:01.472Z';
  core.metadata.generatedAt = stamp; member.snapshot = stamp;
  for (let number = 2; number <= generation; number++) {
    // Old publication/event dates must still be new when first observed later.
    const vote = { ...originalCore.votes[0], id: 'browser-backfill-vote-' + number, date: '2023-04-03T12:00:00Z', startsAt: '2023-04-03T12:00:00Z', title: 'Browser backfilled vote ' + number };
    core.votes.push(vote);
    member.ballots.push([vote.id, mpId, mp.party, 'yes']);
    member.speeches.push({ ...originalMember.speeches[0], id: 'browser-backfill-speech-' + number, date: '2023-04-03T12:00:00Z', agenda: 'Browser backfilled speech ' + number });
    core.members[0].stats.votes++; core.members[0].stats.speeches++;
    core.metadata.counts.votes++; core.metadata.counts.ballots++; core.metadata.counts.speeches++;
  }
  return { core, member, laws: { ...legislation, snapshot: stamp } };
}

async function fixtures(page, state) {
  await page.route('**/data/parliament/core.json*', route => route.fulfill({ json: snapshot(state.generation).core }));
  await page.route('**/data/parliament/member-0.json*', async route => {
    if (state.memberGate) await state.memberGate;
    return state.memberFailure ? route.abort() : route.fulfill({ json: snapshot(state.generation).member });
  });
  await page.route('**/data/parliament/legislation.json*', route => route.fulfill({ json: snapshot(state.generation).laws }));
  await page.route('**/data/parliament/party-votes.json*', route => route.fulfill({ json: { ...partyVotes, snapshot: snapshot(state.generation).core.metadata.generatedAt } }));
  await page.route('**/data/ai-insights.json*', route => route.fulfill({ json: aiIndex }));
  await page.route('**/data/influence.json*', route => route.fulfill({ json: influence }));
}
async function routeTo(page, hash) {
  await page.evaluate(hash => { location.hash = hash; }, hash);
  await page.waitForFunction(hash => document.querySelector('#content')?.dataset.route === hash && document.querySelector('#content')?.getAttribute('aria-busy') === 'false', hash);
  assert.equal(await page.locator('.load-error').count(), 0, hash + ': route source load succeeded');
}
async function followingReady(page) {
  await page.locator('[data-follow-export]').waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('#content')?.getAttribute('aria-busy') === 'false');
  await page.locator('[data-follow-sources][aria-busy="false"]').waitFor();
}
async function selections(page) {
  return page.evaluate(() => ({ members: JSON.parse(localStorage.getItem('vahtikissa-followed-members') || '[]'), tags: JSON.parse(localStorage.getItem('vahtikissa-ai-tags') || '[]') }));
}
async function importText(page, text, name = 'following.json') {
  const transfer = page.locator('.following-transfer');
  if (!await transfer.evaluate(details => details.open)) await transfer.locator(':scope > summary').click();
  // Wait for this file's async reader, even if the previous import had the same error.
  await page.locator('[data-follow-status]').evaluate(status => { status.textContent = ''; });
  await page.locator('[data-follow-import]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.waitForFunction(() => !!document.querySelector('[data-follow-status]')?.textContent.trim());
}

async function checkManualRefresh(browser, view) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
  const state = { generation: 1 };
  await fixtures(page, state);
  await page.addInitScript(({ mpId, tagId }) => {
    localStorage.setItem('vahtikissa-followed-members', JSON.stringify([mpId]));
    localStorage.setItem('vahtikissa-ai-tags', JSON.stringify([tagId]));
  }, { mpId, tagId });
  await page.goto(origin + '/?view=' + view + '#/following');
  await followingReady(page);
  assert.equal(await page.locator('[data-follow-new]').count(), 0);
  const documentToken = await page.evaluate(() => window.followingBrowserDocumentToken = Math.random());
  const refresh = async generation => {
    state.generation = generation;
    const previousButton = await page.locator('[data-follow-refresh]').elementHandle();
    await page.locator('[data-follow-refresh]').click();
    await page.waitForFunction(button => !button.isConnected, previousButton);
    await followingReady(page);
    await page.waitForFunction(() => document.activeElement?.matches('[data-follow-refresh]'));
    assert.equal(await page.evaluate(() => window.followingBrowserDocumentToken), documentToken, 'Manual refresh stays in the same loaded document');
  };
  await refresh(2);
  assert.equal(await page.locator('[data-follow-new]').count(), 2, 'Manual refresh in the first-use document marks new backfilled votes/speeches');
  const firstVote = page.locator('.following-records li').filter({ has: page.locator('a[href="#/votes/browser-backfill-vote-2"]') });
  const firstObserved = await firstVote.locator('.following-note').first().innerText();
  await refresh(3);
  assert.equal(await page.locator('[data-follow-new]').count(), 4, 'Later same-document refresh retains earlier new badges and adds new records');
  assert.equal(await firstVote.locator('.following-note').first().innerText(), firstObserved, 'First-observed time stays stable across manual refreshes');
  await refresh(3);
  assert.equal(await page.locator('[data-follow-new]').count(), 4, 'Repeated refresh of the same snapshot preserves visit newness');

  // Keep an actual source request pending while selection controls rerender the feed.
  let releaseMember;
  state.memberGate = new Promise(resolve => { releaseMember = resolve; });
  state.generation = 4;
  const previousButton = await page.locator('[data-follow-refresh]').elementHandle();
  await page.locator('[data-follow-refresh]').click();
  await page.waitForFunction(button => !button.isConnected, previousButton);
  await page.locator('[data-follow-sources][aria-busy="true"]').waitFor({ state: 'attached' });
  await page.locator('[data-follow-remove-tag="' + tagId + '"]').click();
  await page.waitForFunction(() => document.activeElement?.id === 'following-themes');
  assert.equal(await page.locator('[data-follow-sources]').getAttribute('aria-busy'), 'true', 'Remove selection restores focus before the pending feed completes');
  await importText(page, JSON.stringify({ type: 'vahtikissa-following', version: 1, members: [mpId], tags: [tagId] }));
  assert.equal(await page.locator('.following-transfer').evaluate(details => details.open), true, 'Successful import keeps the transfer section open');
  await page.waitForFunction(() => document.activeElement?.matches('[data-follow-import]'));
  assert.equal(await page.locator('[data-follow-sources]').getAttribute('aria-busy'), 'true', 'Import restores input focus before slow sources finish');
  state.memberGate = undefined; releaseMember();
  await followingReady(page);
  assert.equal(await page.locator('.following-transfer').evaluate(details => details.open), true);
  assert.equal(await page.locator('[data-follow-import]').evaluate(input => input === document.activeElement), true, 'Completed background feed must not steal focus from the latest import');
  await context.close();
}

let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  await mkdir(new URL('../.hermes-tmp.following/', import.meta.url), { recursive: true });
  for (const view of ['full', 'simple']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await context.newPage(), state = { generation: 1, memberFailure: false }, errors = [], dataRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/data/')) dataRequests.push(request.url()); });
    await fixtures(page, state);
    await page.addInitScript(tagId => {
      if (localStorage.getItem('vahtikissa-ai-tags') === null) localStorage.setItem('vahtikissa-ai-tags', JSON.stringify([tagId]));
    }, tagId);
    await page.goto(origin + '/?view=' + view + '#/overview');
    await page.waitForFunction(() => document.querySelector('#content')?.getAttribute('aria-busy') === 'false');
    assert.equal(dataRequests.some(url => /member-\d+\.json|influence\.json|legislation\.json/.test(url)), false, view + ': unrelated home keeps following sources lazy');
    await routeTo(page, '#/members/' + mpId);
    const follow = page.locator('[data-follow-member="' + mpId + '"]');
    assert.equal(await follow.getAttribute('aria-pressed'), 'false');
    await follow.focus(); await follow.press('Enter');
    assert.equal(await follow.getAttribute('aria-pressed'), 'true');
    assert.equal(await follow.evaluate(button => button === document.activeElement), true, 'Following leaves keyboard focus on the control');
    assert.deepEqual(await selections(page), { members: [mpId], tags: [tagId] });
    await page.locator('.menu-button').click();
    await page.locator('.nav [data-page="following"]').click();
    await followingReady(page);
    assert.equal(await page.locator('[data-follow-new]').count(), 0, 'First visit establishes a baseline without marking history new');
    assert.equal(await page.locator('[data-follow-remove-member="' + mpId + '"]').count(), 1);
    assert.ok((await page.locator('#content').innerText()).includes(tag.label.fi), 'Legacy programme-theme follows appear alongside MPs');
    assert.equal(await page.locator('#content').evaluate(element => element === document.activeElement), true, 'Navigation focuses the main content');
    await page.locator('[data-follow-influence]').click();
    await page.locator('[data-follow-source="mp:' + mpId + ':gifts"]').waitFor();
    await followingReady(page);
    assert.ok((await page.locator('[data-follow-source="mp:' + mpId + ':gifts"]').innerText()).includes('Browser gift source'));
    assert.ok((await page.locator('[data-follow-source="mp:' + mpId + ':lobbying"]').innerText()).includes('Browser lobbying source'));
    assert.equal(await page.locator('[data-follow-new]').count(), 0, 'Optional civic sources establish their own first-use baselines');
    const initialSelections = await selections(page);
    for (const invalid of ['{broken', JSON.stringify({ type: 'vahtikissa-following', version: 99, members: [], tags: [] }), JSON.stringify({ type: 'vahtikissa-following', version: 1, members: ['unknown-mp'], tags: [] }), ' '.repeat(100_001)]) {
      await importText(page, invalid);
      assert.deepEqual(await selections(page), initialSelections, 'Malformed, incompatible, unknown or oversized imports preserve selections');
    }
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-follow-export]').click();
    const download = await downloadPromise, exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.deepEqual(Object.keys(exported).sort(), ['members', 'tags', 'type', 'version']);
    assert.deepEqual(exported.members, [mpId]); assert.deepEqual(exported.tags, [tagId]);
    assert.ok(!JSON.stringify(exported).includes('snapshot'), 'Export excludes observation history');
    await page.locator('[data-follow-remove-member="' + mpId + '"]').click();
    assert.deepEqual((await selections(page)).members, []);
    await importText(page, JSON.stringify(exported));
    assert.deepEqual(await selections(page), initialSelections, 'Valid import restores only selected MPs/themes');
    assert.equal(await page.locator('.following-transfer').evaluate(details => details.open), true, 'Import keeps its controls expanded');
    assert.equal(await page.locator('[data-follow-import]').evaluate(input => input === document.activeElement), true, 'Import restores keyboard focus to the file control');

    state.generation = 2;
    await page.reload(); await followingReady(page);
    const newCount = await page.locator('[data-follow-new]').count();
    assert.ok(newCount >= 2, 'Later complete snapshot marks appended vote and speech with old source dates as newly observed');
    for (const language of ['sv', 'en', 'fi']) {
      await page.locator('.language-select').selectOption(language); await followingReady(page);
      assert.equal(await page.locator('[data-follow-new]').count(), newCount, 'Language rerender preserves the visit baseline');
    }
    await page.locator('.view-toggle').click(); await followingReady(page);
    assert.equal(await page.locator('[data-follow-new]').count(), newCount, 'Reading-mode rerender preserves the visit baseline');
    await page.locator('.view-toggle').click(); await followingReady(page);
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    for (const theme of ['light', 'dark', 'contrast']) {
      await page.locator('.theme-select').selectOption(theme);
      const violations = await page.evaluate(async () => (await axe.run(document.querySelector('#content'), { rules: { region: { enabled: false } } })).violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })));
      assert.deepEqual(violations, [], view + ' / ' + theme + ': accessible Following controls and feed');
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, view + ' / ' + theme + ' / ' + width + ': no mobile overflow');
      }
    }
    await page.locator('.theme-select').selectOption('light');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: fileURLToPath(new URL('../.hermes-tmp.following/' + view + '-selections.png', import.meta.url)) });
    await page.locator('[data-follow-source] > h3').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: fileURLToPath(new URL('../.hermes-tmp.following/' + view + '-records.png', import.meta.url)) });
    await page.reload(); await followingReady(page);
    assert.equal(await page.locator('[data-follow-new]').count(), 0, 'Repeat document visit uses the last successfully observed snapshot');
    const beforeFailure = await page.evaluate(() => JSON.parse(localStorage.getItem('vahtikissa-following-snapshots')));
    state.generation = 3; state.memberFailure = true;
    await page.reload(); await followingReady(page);
    assert.equal(await page.locator('.load-error').count(), 0, 'One unavailable member source does not block Following');
    const afterFailure = await page.evaluate(() => JSON.parse(localStorage.getItem('vahtikissa-following-snapshots')));
    for (const source of ['mp:' + mpId + ':votes', 'mp:' + mpId + ':speeches']) {
      assert.deepEqual(afterFailure.sources[source], beforeFailure.sources[source], 'Failed source never advances its baseline');
    }
    state.memberFailure = false;
    await page.reload(); await followingReady(page);
    assert.ok(await page.locator('[data-follow-new]').count() >= 2, 'Recovery still identifies additions from the failed visit');
    await routeTo(page, '#/members/' + mpId);
    assert.equal(await page.locator('[data-follow-member="' + mpId + '"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-follow-member="' + mpId + '"]').click();
    assert.equal(await page.locator('[data-follow-member="' + mpId + '"]').getAttribute('aria-pressed'), 'false');
    await routeTo(page, '#/votes');
    await page.locator('.ai-monitor > summary').click();
    await page.locator('.ai-theme-list > details > summary').first().click();
    await page.locator('[data-ai-follow="' + tagId + '"]').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('vahtikissa-ai-tags') || '[]').length === 0);
    assert.deepEqual((await selections(page)).tags, [], 'Existing theme control and Following share the legacy key');
    await routeTo(page, '#/following');
    assert.equal(await page.locator('[data-follow-source]').count(), 0, 'Removing all follows produces a usable empty view');
    assert.ok(await page.locator('#content a[href="#/members"]').count(), 'Empty view offers a way to find MPs');
    assert.deepEqual(errors, []);
    await context.close();
    await checkManualRefresh(browser, view);
    console.log('Following browser interactions passed: ' + view + ', FI/SV/EN, three themes, 320/390px, import/export, backfills, partial failure and frozen visit baselines.');
  }

  for (const failure of ['denied', 'full', 'corrupt']) {
    const context = await browser.newContext(), page = await context.newPage(), state = { generation: 1 };
    await fixtures(page, state);
    await page.addInitScript(failure => {
      if (failure === 'corrupt') localStorage.setItem('vahtikissa-followed-members', '{broken');
      else {
        if (failure === 'denied') Storage.prototype.getItem = () => { throw new DOMException('Denied', 'SecurityError'); };
        Storage.prototype.setItem = () => { throw new DOMException('Unavailable', failure === 'full' ? 'QuotaExceededError' : 'SecurityError'); };
      }
    }, failure);
    await page.goto(origin + '/?view=full#/members/' + mpId);
    const follow = page.locator('[data-follow-member="' + mpId + '"]'); await follow.waitFor();
    await follow.click();
    assert.equal(await follow.getAttribute('aria-pressed'), 'false', failure + ': failed persistence must not claim an MP was saved');
    assert.equal(await page.locator('.load-error').count(), 0, failure + ': public MP page remains usable');
    assert.match(await page.locator('[data-follow-status]').innerText(), /tallenn|storage|lagr|vioitt/i, failure + ': storage problem is explained');
    await routeTo(page, '#/following');
    assert.equal(await page.locator('[data-follow-export]').count(), 1, failure + ': Following remains usable with unavailable storage');
    await context.close();
  }
  console.log('Following browser checks passed, including storage denial, full storage and corrupt selections.');
} finally {
  await browser?.close(); server.kill();
}
