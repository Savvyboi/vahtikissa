import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url);
const port=process.env.RELEASE_TEST_PORT||'4198',url=process.env.BROWSER_TEST_URL||`http://localhost:${port}`;
const server=process.env.BROWSER_TEST_URL?null:spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:port},stdio:'ignore',windowsHide:true});
const data=JSON.parse(await readFile(new URL('../data/parliament.json',import.meta.url),'utf8'));
let browser;
try {
  for(let i=0;i<50;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.stack||error.message));
  const ready=()=>page.locator('main[aria-busy="false"] h1').waitFor();
  const visit=async(route,view='full')=>{
    await page.goto(`${url}/?view=${view}#/${route}`);
    await page.waitForFunction(({route,view})=>{const main=document.querySelector('main');return main?.dataset.route==='#/'+route&&main.dataset.view===view&&main.getAttribute('aria-busy')==='false'&&main.querySelector('h1');},{route,view});
    assert.equal(await page.locator('.load-error').count(),0,view+' '+route+' loads successfully');
  };
  const audit=async label=>{
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
    assert.deepEqual(violations,[],label);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' overflow');
  };
  const routes=['overview','votes','members','parties','sessions','speeches','legislation','budget','elections','influence','programmes',`members/${data.members[0].id}`,`sessions/${data.sessions[0].id}`,`parties/${data.parties[0].code}`];
  for(const view of ['full','simple']) {
    for(const route of routes) {
      await visit(route,view);
      const panels=page.locator('[data-filter-panel]');
      if(['votes','members','speeches','legislation','budget','elections','programmes'].includes(route))assert.ok(await panels.count(),`${view} ${route} has collapsed advanced controls`);
      if(route==='influence'){
        for(const selector of ['[data-influence-common="query"]','[data-influence-common="period"]','[data-influence-order]','[data-influence-min]'])assert.equal(await page.locator(selector).isVisible(),true,`${view} influence exposes common tasks`);
      }
      for(const panel of await panels.all()) {
        assert.equal(await panel.evaluate(p=>p.open),false,`${view} ${route} starts collapsed`);
        for(const control of await panel.locator('input:not([type="hidden"]), select').all())assert.equal(await control.isVisible(),false,`${view} ${route} hides fields`);
      }
    }
  }
  const debate=data.sessions.find(session=>!session.voteIds.length&&session.speechCount);
  assert.ok(debate,'Debate-only sessions must be present in the published snapshot');
  for(const view of ['full','simple']) {
    await visit('sessions/'+debate.id,view);
    const speechLinks=page.locator('.session-speeches a[href^="#/speeches/"]');
    assert.equal(await speechLinks.evaluateAll(links=>new Set(links.map(link=>link.hash)).size),view==='simple'?Math.min(20,debate.speechCount):debate.speechCount,'Session speeches remain accessible without votes');
    assert.equal(await page.locator('.data-freshness time').count(),3,'Refresh, vote and speech dates are distinct');
    const route=(await speechLinks.first().getAttribute('href')).slice(2);
    await visit(route,view);
    assert.ok(await page.locator(view==='simple'?'.easy-transcript':'.speech').count(),'A session speech opens successfully');
  }
  await mkdir(new URL('../.hermes-tmp.release/',import.meta.url),{recursive:true});
  for(const view of ['full','simple']) {
    await visit('members',view);
    const search=page.locator(view==='full'?'[data-member-query]':'[data-easy-filter="query"]');
    const panel=search.locator('xpath=ancestor::details[@data-filter-panel]'),summary=panel.locator(':scope > summary');
    await summary.focus();await page.keyboard.press('Space');
    assert.equal(await panel.evaluate(p=>p.open),true,'Space opens the disclosure');
    await search.fill('zzzz-no-matching-member');
    assert.equal(await search.evaluate(e=>e===document.activeElement),true,'Typing keeps focus');
    await summary.focus();await page.keyboard.press('Enter');
    assert.equal(await panel.evaluate(p=>p.open),false,'Enter closes the disclosure');
    assert.match(await summary.innerText(),/1/,'Active search remains visible when closed');
    await page.keyboard.press('Tab');
    assert.equal(await search.evaluate(e=>e===document.activeElement),false,'Tab skips collapsed search');
    await summary.click();await search.fill('');
    assert.equal(await search.inputValue(),'');
    await summary.click();
    for(const theme of ['light','dark','contrast']) {
      await page.locator('.theme-select').selectOption(theme);
      await audit(`${view} / collapsed / ${theme}`);
      await summary.click();await audit(`${view} / expanded / ${theme}`);await summary.click();
    }
    await page.locator('.theme-select').selectOption('light');
    await page.setViewportSize({width:320,height:740});await audit(`${view} / 320px / collapsed`);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:fileURLToPath(new URL(`../.hermes-tmp.release/${view}-members-mobile.png`,import.meta.url)),fullPage:false});
    await summary.click();await audit(`${view} / 320px / expanded`);
    await page.setViewportSize({width:1440,height:1000});
  }
  // Views which rebuild their markup must retain both disclosure state and focus.
  for(const [route,selector,view] of [['budget','[data-budget-search]','full'],['programmes','[data-programme-query]','full'],['influence','[data-influence-common="query"]','full'],['budget','[data-easy-filter="query"]','simple'],['influence','[data-influence-common="query"]','simple']]) {
    await visit(route,view);
    const input=page.locator(selector).first(),panel=input.locator('xpath=ancestor::details[@data-filter-panel]');
    if(route!=='influence')await panel.locator(':scope > summary').click();
    await input.fill('zzzz');
    if(route!=='influence')assert.equal(await panel.evaluate(p=>p.open),true,route+' remains open');
    assert.equal(await input.evaluate(e=>e===document.activeElement),true,route+' keeps keyboard focus');
    await input.fill('');
  }
  await visit('votes');await page.screenshot({path:fileURLToPath(new URL('../.hermes-tmp.release/full-votes-desktop.png',import.meta.url)),fullPage:false});
  for(const malformed of ['%','%ZZ','%E0%A4%A']) {
    await visit('members/'+malformed);assert.equal(await page.locator('.load-error').count(),0,'Malformed links show a usable not-found page');
    await page.locator('.brand').first().click();await ready();assert.equal(await page.locator('main').getAttribute('data-route'),'#/overview');
  }
  for(const blocked of ['read','write']) {
    const blockedContext=await browser.newContext();
    await blockedContext.addInitScript(mode=>{
      if(mode==='read')Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
      else Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};
    },blocked);
    const blockedPage=await blockedContext.newPage();
    blockedPage.on('pageerror',error=>errors.push(error.message));
    await blockedPage.goto(`${url}/?view=full#/votes`);await blockedPage.locator('main[aria-busy="false"] h1').waitFor();
    await blockedPage.locator('.language-select').selectOption('sv');await blockedPage.locator('.theme-select').selectOption('dark');
    await blockedPage.locator('.view-toggle').click();
    await blockedPage.waitForFunction(()=>document.querySelector('main')?.dataset.view==='simple'&&document.querySelector('main')?.getAttribute('aria-busy')==='false');
    assert.equal(await blockedPage.locator('html').getAttribute('lang'),'sv');
    assert.equal(await blockedPage.locator('html').getAttribute('data-theme'),'dark');
    await blockedContext.close();
  }
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('Release regressions passed: visible influence controls, collapsible advanced panels, keyboard control, active counts, rerender focus, themes, mobile, malformed URLs and blocked browser storage.');
} finally {await browser?.close();server?.kill();}
