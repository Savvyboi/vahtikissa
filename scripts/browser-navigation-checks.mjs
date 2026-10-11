import assert from 'node:assert/strict';

/** Follow primary navigation through the same visible controls as a keyboard or pointer user. */
export async function followPrimaryNavigation(page, route) {
  const menu = page.locator('.menu-button');
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  const previousScroll=await page.evaluate(()=>scrollY);
  await page.locator(`.nav [data-page="${route}"]`).click();
  await page.waitForFunction(route => {
    const main=document.querySelector('main');
    return main?.dataset.route===`#/${route}`&&main.getAttribute('aria-busy')==='false'&&main.querySelector('h1');
  },route);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const position=await page.evaluate(()=>({y:scrollY,max:Math.max(0,document.documentElement.scrollHeight-innerHeight)}));
  assert.ok(Math.abs(position.y-Math.min(previousScroll,position.max))<=2,`${route} keeps the reader's position within the available page height: before ${previousScroll}, after ${position.y}, max ${position.max}`);
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


/** Exercise actual route controls and browser history without forcing a return to the page top. */
export async function checkSeamlessNavigation(browser, url) {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(()=>localStorage.setItem('vahtikissa-view','full'));
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.stack||error.message));
  let releaseAsync=()=>{};
  const ready=async hash=>{
    await page.waitForFunction(hash=>{
      const main=document.querySelector('main');
      return main?.dataset.route===hash&&main.getAttribute('aria-busy')==='false'&&main.querySelector('h1');
    },hash);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  };
  const scroll=async y=>{
    await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(()=>scrollY),y);
  };
  const retained=async(y,label)=>{
    const actual=await page.evaluate(()=>({y:scrollY,max:Math.max(0,document.documentElement.scrollHeight-innerHeight)}));
    assert.ok(Math.abs(actual.y-Math.min(y,actual.max))<=2,`${label}: expected ${Math.min(y,actual.max)}, received ${actual.y}`);
  };
  try {
    await page.goto(`${url}/?view=full#/votes`);
    await ready('#/votes');
    await scroll(620);
    await followPrimaryNavigation(page,'members');
    await retained(620,'Route links preserve the reading position');
    await scroll(1040);
    await followPrimaryNavigation(page,'votes');
    await scroll(1550);
    await page.goBack();await ready('#/members');await retained(1040,'Back restores the member list position');
    await page.goBack();await ready('#/votes');await retained(620,'Back restores the earlier vote list position');
    await page.goForward();await ready('#/members');await retained(1040,'Forward restores the member list position');
    await page.goForward();await ready('#/votes');await retained(1550,'Forward restores the later vote list position');
    const historyLength=await page.evaluate(()=>history.length);
    await followPrimaryNavigation(page,'votes');
    assert.equal(await page.evaluate(()=>history.length),historyLength,'The current link does not add duplicate history entries');
    await retained(1550,'The current link keeps the reading position');
    await page.reload();await ready('#/votes');await retained(1550,'Reload restores this history entry position');

    await scroll(620);
    await page.keyboard.press('Control+k');
    assert.equal(await page.locator('#global-search').evaluate(element=>element===document.activeElement),true);
    await retained(620,'Opening search does not move the page');
    await page.keyboard.press('Escape');
    await retained(620,'Closing search does not move the page');

    const waiting=new Promise(resolve=>{releaseAsync=resolve});
    await page.route('**/data/influence.json',async route=>{await waiting;await route.continue()});
    const menu=page.locator('.menu-button');
    if(await menu.isVisible()&&await menu.getAttribute('aria-expanded')!=='true')await menu.click();
    await page.locator('.nav [data-page="influence"]').click();
    await page.locator('main .loading').waitFor();
    await retained(620,'The asynchronous loading placeholder does not collapse the page');
    await scroll(900);
    releaseAsync();await ready('#/influence');
    await retained(900,'Loading completion keeps the latest reader position');
    await page.unroute('**/data/influence.json');
    assert.equal(await page.locator('main').evaluate(element=>element.style.minHeight),'','Temporary loading height is released');

    await page.setViewportSize({width:320,height:568});
    await page.locator('.language-select').selectOption('en');await ready('#/influence');
    await page.locator('[data-influence-tab="lobbying"]').click();
    await page.locator('main details').evaluateAll(elements=>elements.forEach(element=>{element.open=true}));
    await followPrimaryNavigation(page,'elections');await scroll(3588);
    await followPrimaryNavigation(page,'influence');
    await retained(3588,'The English guide preserves the position when cached asynchronous content loads');
    assert.equal(await page.locator('.language-note').count(),1);
    await page.locator('.language-select').selectOption('fi');await ready('#/influence');
    await page.setViewportSize({width:1440,height:900});

    await followPrimaryNavigation(page,'votes');
    const nextPage=page.locator('[data-pagination="votes"] [data-page="2"]').first();
    await nextPage.scrollIntoViewIfNeeded();
    const paginationPosition=await page.evaluate(()=>scrollY);
    await nextPage.click();
    assert.equal(await page.locator('[data-pagination="votes"] [aria-current="page"]').innerText(),'2');
    await retained(paginationPosition,'Pagination keeps the reading position');

    await scroll(620);
    await followPrimaryNavigation(page,'budget');
    const budgetItem=page.locator('.budget-map-key a').first();
    await budgetItem.scrollIntoViewIfNeeded();
    const budgetPosition=await page.evaluate(()=>scrollY), budgetHash=await budgetItem.getAttribute('href');
    await budgetItem.click();await ready(budgetHash);
    await retained(budgetPosition,'Budget drill-down keeps the reading position');
    assert.equal(await page.locator('#budget-explorer-title').evaluate(element=>element===document.activeElement),true);
    await page.goBack();await ready('#/budget');await retained(budgetPosition,'Budget Back restores the explorer position');

    const parliament=await (await fetch(`${url}/data/parliament.json`)).json(), speech=parliament.speeches[2];
    const speechHash=`#/speeches/${encodeURIComponent(speech.id)}`, speechPage=await context.newPage();
    speechPage.on('pageerror',error=>errors.push(error.stack||error.message));
    await speechPage.goto(`${url}/?view=full${speechHash}`);
    await speechPage.locator('main[aria-busy="false"] .speech').first().waitFor();
    await speechPage.waitForFunction(()=>scrollY>0);
    await speechPage.locator('[data-speech-analytics][aria-busy="false"]').waitFor();
    const speechPosition=await speechPage.evaluate(()=>scrollY+450);
    await speechPage.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),speechPosition);
    await speechPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await followPrimaryNavigation(speechPage,'members');
    await speechPage.goBack();
    await speechPage.waitForFunction(hash=>document.querySelector('main')?.dataset.route===hash&&document.querySelector('main')?.getAttribute('aria-busy')==='false',speechHash);
    await speechPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await speechPage.evaluate(()=>scrollY),speechPosition,'Returning to a speech preserves the reading position instead of jumping to its beginning');
    await speechPage.reload();
    await speechPage.locator('main[aria-busy="false"] .speech').first().waitFor();
    await speechPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await speechPage.evaluate(()=>scrollY),speechPosition,'Reloading a speech preserves the saved reading position');
    await speechPage.locator('.language-select').selectOption('sv');
    await speechPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await speechPage.evaluate(()=>scrollY),speechPosition,'Changing language preserves the speech reading position');
    await speechPage.close();

    await followPrimaryNavigation(page,'votes');await scroll(620);
    await page.setViewportSize({width:390,height:844});
    await scroll(620);
    await followPrimaryNavigation(page,'members');
    await retained(620,'Mobile menu navigation keeps the reading position');
    assert.equal(await page.locator('.menu-button').getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('main').evaluate(element=>element===document.activeElement),true);
    await page.locator('.skip').focus();await page.keyboard.press('Enter');
    assert.ok(await page.evaluate(()=>scrollY<120),'The explicit skip link still moves to main content');
    assert.deepEqual(errors,[]);
    console.log('Seamless desktop/mobile navigation, browser history, reload, async loading, pagination, budget, speech links and search passed.');
  } finally { releaseAsync();await context.close(); }
}
