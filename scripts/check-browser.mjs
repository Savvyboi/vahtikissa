import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const data = JSON.parse(await readFile(new URL('../data/parliament.json',import.meta.url),'utf8'));
const port = process.env.BROWSER_TEST_PORT || '4174';
const url = process.env.BROWSER_TEST_URL || `http://localhost:${port}`;
const server = process.env.BROWSER_TEST_URL ? null : spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:port},stdio:'ignore',windowsHide:true});
let browser;
  const failures=[];
try {
  for(let attempt=0;attempt<50;attempt++) {
    try { if((await fetch(url)).ok)break; } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',error=>failures.push(`JavaScript: ${error.message}`));
  await page.goto(url);
  await page.locator('main[aria-busy="false"] h1').waitFor();
  const routes=['overview','votes','members','parties','sessions','speeches','legislation','budget','elections','influence','about',`votes/${encodeURIComponent(data.votes[0].id)}`,`members/${data.members[0].id}`,`parties/${data.parties[0].code}`,`sessions/${data.sessions[0].id}`,`legislation/${encodeURIComponent(data.legislation.find(item=>item.voteIds.length)?.id)}`];
  async function navigate(route) {
    await page.evaluate(route=>{location.hash=`#/${route}`;},route);
    await page.waitForFunction(route=>{const main=document.querySelector('main');return main?.dataset.route===`#/${route}`&&main.getAttribute('aria-busy')==='false'&&main.querySelector('h1');},route);
    await page.locator('main[aria-busy="false"] h1').waitFor();
    assert.equal(await page.locator('.share-tools, [data-share]').count(),0);
  }
  async function audit(label) {
    // Navigation preserves scroll position; audit each view from a consistent origin.
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const violations=await page.evaluate(async()=>{
      const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});
      return result.violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.slice(0,4).map(node=>({target:node.target,summary:node.failureSummary}))}));
    });
    if(violations.length){failures.push({label,violations});console.log(JSON.stringify({label,violations}));}
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    if(overflow)failures.push(`${label}: horizontal page overflow`);
    console.log(`${label}: ${violations.length} accessibility findings`);
  }
  for(const route of routes) {await navigate(route);await audit(`fi / desktop / ${route}`);}
  await navigate('influence');
  for(const tab of ['interests','lobbying']) {await page.locator(`[data-influence-tab="${tab}"]`).click();await audit(`fi / influence / ${tab}`);}
  await navigate('elections');await page.locator('[data-election-tab="candidates"]').click();await audit('fi / elections / candidates');

  // Real interactions exercise filtering, sorting, pagination and focus retention.
  await navigate('members');
  await page.locator('[data-collection="members"] [data-advanced] > summary').click();
  const partyFacet=page.locator('[data-collection="members"] [data-facet="party"]');
  await partyFacet.locator('summary').click();
  const checkbox=partyFacet.locator('[data-selection="include"][value="kok"]');
  await checkbox.check();
  assert.equal(await checkbox.evaluate(element=>element===document.activeElement),true);
  assert.equal(await page.locator('[data-member-count]').innerText(),`${data.members.filter(member=>member.party==='kok').length} kansanedustajaa`);
  await partyFacet.locator('[data-selection="exclude"][value="kok"]').check();
  assert.equal(await checkbox.isChecked(),false);
  assert.equal(await page.locator('[data-member-count]').innerText(),`${data.members.filter(member=>member.party!=='kok').length} kansanedustajaa`);
  const sort=page.locator('[data-collection="members"] [data-tool="sort"]');
  await sort.selectOption('speeches');
  await page.locator('[data-collection="members"] [data-tool="direction"]').selectOption('desc');
  const expected=[...data.members].filter(member=>member.party!=='kok').sort((a,b)=>b.stats.speeches-a.stats.speeches)[0];
  assert.match(await page.locator('[data-list] tbody tr').first().innerText(),new RegExp(expected.lastName));
  const downloaded=page.waitForEvent('download');await page.locator('[data-export-key="members"][data-export-format="json"]').click();
  const download=await downloaded,exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(exported.length,data.members.filter(member=>member.party!=='kok').length);
  assert.equal(exported[0].id,expected.id);
  await navigate('votes');await page.locator('[data-pagination="votes"] [data-page="2"]').first().click();
  assert.equal(await page.locator('[data-pagination="votes"] [aria-current="page"]').innerText(),'2');
  await page.locator('.nav [data-page="members"]').click();assert.match(page.url(),/#\/members$/);
  assert.equal(await page.locator('main').evaluate(element=>element===document.activeElement),true);
  await page.locator('.search-button').click();await page.locator('.search-close').click();
  assert.equal(await page.locator('.search-button').evaluate(element=>element===document.activeElement),true);
  await navigate('budget');
  await page.locator('[data-collection="budget"] [data-tool="direction"]').selectOption('asc');
  const budgetAdvanced=page.locator('[data-collection="budget"] [data-advanced]');await budgetAdvanced.locator(':scope > summary').click();
  const budgetFacet=page.locator('[data-collection="budget"] [data-facet="code"]');await budgetFacet.locator('summary').click();
  const budgetInclude=budgetFacet.locator('[data-selection="include"]').first();const budgetCode=await budgetInclude.inputValue();await budgetInclude.check();
  assert.equal(await page.locator('.budget-bars .budget-row').count(),1);
  assert.equal(await page.locator(`[data-collection="budget"] [data-facet="code"] [data-selection="include"][value="${budgetCode}"]`).evaluate(element=>element===document.activeElement),true);
  await navigate('influence');await page.locator('[data-influence-tab="gifts"]').click();
  await page.locator('[data-collection="influence"] [data-advanced] > summary').click();
  const yearFacet=page.locator('[data-collection="influence"] [data-facet="year"]');await yearFacet.locator('summary').click();
  const yearCheckbox=yearFacet.locator('[data-selection="include"]').first(),year=await yearCheckbox.inputValue();await yearCheckbox.check();
  const influence=JSON.parse(await readFile(new URL('../data/influence.json',import.meta.url),'utf8'));
  assert.equal(await page.locator('.gift-card').count(),Math.min(100,influence.gifts.filter(gift=>String(gift.year)===year).length));
  assert.equal(await page.locator(`[data-collection="influence"] [data-facet="year"] [data-selection="include"][value="${year}"]`).evaluate(element=>element===document.activeElement),true);

  await page.setViewportSize({width:320,height:740});
  for(const route of ['overview','votes','members','sessions','speeches','legislation','budget','elections','influence']) {await navigate(route);await audit(`fi / 320px / ${route}`);}
  await page.locator('.menu-button').click();await audit('fi / 320px / open menu');await page.keyboard.press('Escape');
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.language-button').click();
  for(const route of ['votes','speeches','legislation','budget','elections','influence']) {await navigate(route);await audit(`sv / desktop / ${route}`);}
  for(const theme of ['dark','contrast']) {
    await page.locator('.theme-select').selectOption(theme);
    for(const route of ['votes','speeches','legislation','budget','elections','influence',routes[11],routes[12],routes[13],routes[15]]) {await navigate(route);await audit(`sv / ${theme} / ${route}`);}
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
  if(failures.length){console.error(JSON.stringify(failures,null,2));throw new Error(`${failures.length} browser/accessibility checks failed`);}
  console.log('Browser interactions, responsive layouts and accessibility checks passed.');
} finally {
  await browser?.close();server?.kill();
}
