import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function checkPageRegressions(browser, url) {
  const data = JSON.parse(await readFile(new URL('../data/parliament.json', import.meta.url), 'utf8'));
  const member = data.members.find(item => item.lastName === 'Orpo');
  const vote = data.votes.find(item => item.document);
  assert.ok(member && vote, 'Search checks use real local MP and vote records');
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const ready = () => page.locator('main[aria-busy="false"] h1').waitFor();
  try {
    await page.route('**/data/speech-search.json', route => route.abort());
    await page.goto(url + '/?view=full#/overview');
    await ready();
    await page.locator('.language-select').selectOption('en');
    await ready();
    await page.locator('.search-button').click();
    const input = page.locator('#global-search');
    await input.fill(member.lastName);
    await page.waitForFunction(() => document.querySelector('#search-status').textContent.includes('Speech search is unavailable'));
    assert.ok(await page.locator(`.search-results a[href="#/members/${member.id}"]`).isVisible(), 'MP results survive a failed speech index');
    await input.fill(vote.document);
    await page.waitForFunction(() => document.querySelector('#search-status').textContent.includes('Speech search is unavailable'));
    assert.ok(await page.locator(`.search-results a[href="#/votes/${encodeURIComponent(vote.id)}"]`).isVisible(), 'Vote results survive a failed speech index');
    await page.unroute('**/data/speech-search.json');
    await input.fill('ilmasto');
    await page.locator('.search-results a[href^="#/speeches/"]').first().waitFor();
    assert.doesNotMatch(await page.locator('#search-status').innerText(), /unavailable|Loading/, 'A later search retries the speech index successfully');
    await input.fill('');
    assert.equal(await page.locator('.search-results').innerText(), '', 'Clearing the query removes stale links immediately');
    assert.equal(await page.locator('#search-status').innerText(), '');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.search-button').evaluate(element => element === document.activeElement), true);

    for (const language of ['fi', 'sv', 'en']) {
      await page.locator('.language-select').selectOption(language);
      await ready();
      const cat = page.locator('footer .cat-character');
      assert.equal(await cat.count(), 1, 'The basket cat belongs to the shared footer');
      assert.equal(await page.locator('main .cat-character').count(), 0, 'The hero contains only its vote statistic');
      const link = page.locator('.footer-cat');
      assert.equal(await link.getAttribute('href'), 'assets/cat-character.svg');
      assert.match(await cat.getAttribute('alt'), language === 'en' ? /cat in a basket/ : language === 'sv' ? /katten/ : /kissa/);
    }
    for (const view of ['full', 'simple']) {
      await page.goto(url + '/?view=' + view + '#/overview');
      await ready();
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.locator('.footer-cat').scrollIntoViewIfNeeded();
        await page.locator('.footer-cat img').evaluate(image => image.decode());
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${view} / ${width}px footer fits the page`);
        assert.ok(await page.locator('footer .brand-name').isVisible(), 'The footer brand stays visible on small screens');
        const box = await page.locator('.footer-cat').boundingBox();
        assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= width + 1, `${view} / ${width}px cat remains visible`);
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }

  // Delayed speech responses retain keyboard focus and cannot overwrite a cleared query.
  const delayedContext = await browser.newContext();
  const delayedPage = await delayedContext.newPage();
  let release, gate;
  const hold = () => { gate = new Promise(resolve => { release = resolve; }); };
  const settle = () => delayedPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  hold();
  try {
    await delayedPage.route('**/data/speech-search.json', async route => { await gate; await route.abort(); });
    await delayedPage.goto(url + '/?view=full#/overview');
    await delayedPage.locator('main[aria-busy="false"] h1').waitFor();
    await delayedPage.locator('.search-button').click();
    const input = delayedPage.locator('#global-search');
    const waiting = delayedPage.waitForRequest(request => request.url().includes('/data/speech-search.json'));
    await input.fill(member.lastName);
    await waiting;
    const match = delayedPage.locator(`.search-results a[href="#/members/${member.id}"]`);
    assert.ok(await match.isVisible(), 'Local results appear while speech loading is stalled');
    await match.focus();
    const firstFailure = delayedPage.waitForEvent('requestfailed', request => request.url().includes('/data/speech-search.json'));
    release();
    await firstFailure;
    await settle();
    assert.equal(await match.evaluate(element => element === document.activeElement), true, 'An async result update preserves the focused search link');
    hold();
    const secondRequest = delayedPage.waitForRequest(request => request.url().includes('/data/speech-search.json'));
    await input.fill(vote.document);
    await secondRequest;
    await input.fill('');
    const secondFailure = delayedPage.waitForEvent('requestfailed', request => request.url().includes('/data/speech-search.json'));
    release();
    await secondFailure;
    await settle();
    assert.equal(await delayedPage.locator('#search-status').innerText(), '', 'Stale failures cannot overwrite a cleared query');
    assert.equal(await delayedPage.locator('.search-results').innerText(), '');
  } finally {
    release();
    await delayedContext.close();
  }
  console.log('Search recovery, immediate local matches, stale-request handling and the shared responsive footer passed.');
}
