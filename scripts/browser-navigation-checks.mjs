import assert from 'node:assert/strict';

/** Follow primary navigation through the same visible controls as a keyboard or pointer user. */
export async function followPrimaryNavigation(page, route) {
  const menu = page.locator('.menu-button');
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.locator(`.nav [data-page="${route}"]`).click();
  await page.waitForFunction(route => {
    const main=document.querySelector('main');
    return main?.dataset.route===`#/${route}`&&main.getAttribute('aria-busy')==='false'&&main.querySelector('h1');
  },route);
}

export async function checkStartupRecovery(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), held = [];
  const pattern = '**/data/parliament.json';
  const hold = route => { held.push(route); };
  try {
    await page.route(pattern, hold);
    const started = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('main#content[tabindex="-1"][aria-busy="true"]').count(), 1);
    const initialHash=new URL(page.url()).hash;
    await page.locator('.skip').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#content').evaluate(element => element === document.activeElement), true);
    assert.equal(new URL(page.url()).hash,initialHash,'Skipping navigation preserves the current application route');
    await page.locator('main .load-error [data-retry]').waitFor({ timeout: 13000 });
    assert.ok(Date.now() - started < 14000, 'A stalled startup leaves loading within the bounded timeout');
    assert.equal(await page.locator('main').getAttribute('aria-busy'), 'false');
    assert.ok(await page.locator('main [role="alert"]').isVisible());
    assert.match(await page.locator('main').innerText(), /liian kauan|för lång tid|too long/i);
    await page.unroute(pattern, hold);
    for (const route of held) await route.abort('timedout').catch(() => {});
    await page.locator('[data-retry]').click();
    await page.locator('main[aria-busy="false"] h1').waitFor();
    assert.equal(await page.locator('.load-error').count(), 0);
    assert.equal(await page.title(),await page.locator('main h1').innerText()+' | Vahtikissa');
    console.log('Initial skip link, bounded loading timeout and successful retry passed.');
  } finally {
    await context.close();
  }
}
