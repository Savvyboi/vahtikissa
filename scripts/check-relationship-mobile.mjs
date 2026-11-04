import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const require=createRequire(import.meta.url),url=process.env.BROWSER_TEST_URL||'http://localhost:4223';
const server=process.env.BROWSER_TEST_URL?null:spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'4223'},cwd:new URL('..',import.meta.url),windowsHide:true,stdio:'ignore'});
let browser;
try{
  for(let n=0;n<150;n++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  const output=new URL('../.hermes-tmp.relationship-mobile/',import.meta.url);await mkdir(output,{recursive:true});
  for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const ready=()=>page.waitForFunction(()=>/^(Analyysi valmis\.|Analysen är klar\.|Analysis ready\.)$/.test(document.querySelector('.relationship-status')?.textContent));
    const close=async()=>{await page.locator('[data-evidence-close]').tap();await page.locator('[data-network-evidence]').waitFor({state:'hidden'});};
    for(const view of ['full','simple'])for(const lang of ['fi','sv','en']){
      await page.goto(`${url}/?view=${view}#/relationships?feature=topic-profiles`);await ready();
      await page.locator('.language-select').selectOption(lang);await ready();
      const source=page.locator('.relationship-topic-chart [data-speech-sources]').first();
      assert.equal(await page.locator('.relationship-topic-chart > li').first().locator('[data-speech-sources]').count(),1,'Five sources use one compact action in the visible topic chart');
      assert.equal(await page.locator('.relationship-detail-table').evaluate(element=>element.open),false,'Advanced topic metrics stay folded initially');
      assert.equal(await page.locator('.relationship-subnav a').count(),2,'Both relationship views remain available on mobile');
      await source.scrollIntoViewIfNeeded();
      const box=await source.boundingBox();assert.ok(box.height>=44&&box.height<=48,'A compact source button retains a touch target');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Wide relationship tables scroll within the page');
      const position=await page.evaluate(()=>scrollY);
      await source.tap();await page.locator('dialog[open][aria-busy="false"] blockquote').waitFor();
      const dialog=page.locator('[data-network-evidence]'),bounds=await dialog.boundingBox();
      assert.ok(bounds.y>=0&&bounds.y+bounds.height<=845,'Tapping shows source content within the mobile viewport');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Source dialog does not widen the page');
      const first=await dialog.locator('blockquote').innerText();
      assert.equal(await dialog.locator('.relationship-source-picker button').count(),5);
      await dialog.locator('.relationship-source-picker button').nth(1).tap();
      await page.waitForFunction(text=>{const quote=document.querySelector('dialog[open][aria-busy="false"] blockquote');return quote&&quote.textContent!==text;},first);
      assert.equal(await dialog.locator('.relationship-source-picker button[aria-pressed="true"]').innerText(),'2','Other stored source speeches work by touch');
      await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
      const violations=await page.evaluate(async()=>(await axe.run('[data-network-evidence]')).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
      assert.deepEqual(violations,[],`${width} ${view} ${lang}: dialog accessibility`);
      if(view==='full'&&lang==='fi')await page.screenshot({path:fileURLToPath(new URL(`source-dialog-${width}.png`,output))});
      await close();
      assert.equal(await source.evaluate(el=>el===document.activeElement),true,'Closing restores focus to the originating action');
      assert.ok(Math.abs(await page.evaluate(()=>scrollY)-position)<2,'Closing keeps the result-list position');
      if(view==='full'&&lang==='fi')await page.screenshot({path:fileURLToPath(new URL(`compact-sources-${width}.png`,output))});
      if(view==='full'&&lang==='fi'){
        for(const theme of ['dark','contrast']){
          await page.locator('.theme-select').selectOption(theme);
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          await source.tap();await page.locator('dialog[open][aria-busy="false"] blockquote').waitFor();
          const themed=await page.evaluate(async()=>(await axe.run('[data-network-evidence]')).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
          assert.deepEqual(themed,[],`${width} ${theme}: source dialog accessibility`);await close();
        }
        await page.locator('.theme-select').selectOption('light');
      }
    }
    await page.goto(`${url}/?view=full#/relationships?feature=vote-neighbours`);await ready();
    const ballots=page.locator('[data-pair]').first();await ballots.scrollIntoViewIfNeeded();
    const buttonBox=await ballots.boundingBox();assert.ok(buttonBox.height<=48&&buttonBox.width>=44,'Ballot labels stay on a single line');
    await ballots.tap();await page.locator('dialog[open] [data-ballot-list] table').waitFor();
    await page.locator('[data-network-evidence] [data-vote-file]').first().tap();await page.locator('dialog[open][aria-busy="false"] h4').waitFor();
    await page.keyboard.press('Escape');await page.locator('[data-network-evidence]').waitFor({state:'hidden'});
    assert.equal(await ballots.evaluate(el=>el===document.activeElement),true,'Escape returns to the ballot action');
    // A late network response must not reopen a source the reader already closed.
    await page.reload();await ready();let release,held=false;
    const intercepted=new Promise(resolve=>{release=resolve;});
    await page.route('**/ballots-*.json*',route=>{if(!held){held=true;release(route);}else route.continue();});
    await page.locator('[data-pair]').first().tap();const pending=await intercepted;
    await page.locator('dialog[open] [role="status"]').waitFor();await close();
    const response=page.waitForResponse(pending.request().url());await pending.continue();await response;
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.locator('dialog[open]').count(),0,'Late source responses stay closed');
    await page.unroute('**/ballots-*.json*');
    // Failed month requests are retryable from the same dialog and source selection.
    await page.goto(`${url}/?view=full#/relationships?feature=topic-profiles`);await ready();let failed=false;
    await page.route('**/speeches-*.json*',route=>{if(!failed){failed=true;route.abort();}else route.continue();});
    await page.locator('.relationship-topic-chart [data-speech-sources]').first().tap();await page.locator('dialog[open] [role="alert"]').waitFor();
    await page.locator('[data-evidence-retry]').tap();await page.locator('dialog[open] blockquote').waitFor();await close();
    assert.deepEqual(errors,[],'No mobile runtime errors');
    console.log(`${width}px touch: compact sources, visible transcripts, all languages/views, source selection, focus/scroll restoration, Escape, late responses and retry passed.`);
    await context.close();
  }
}finally{await browser?.close();server?.kill();}
