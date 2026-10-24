import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require=createRequire(import.meta.url),port=process.env.BROWSER_TEST_PORT||'4196';
const url=process.env.BROWSER_TEST_URL||`http://localhost:${port}`;
const server=process.env.BROWSER_TEST_URL?null:spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:port},stdio:'ignore',windowsHide:true});
const output=new URL('../.hermes-tmp.improvements/',import.meta.url);
const influence=JSON.parse(await readFile(new URL('../data/influence.json',import.meta.url),'utf8'));
const parliament=JSON.parse(await readFile(new URL('../data/parliament.json',import.meta.url),'utf8'));
const profiles=JSON.parse(await readFile(new URL('../data/member-profiles.json',import.meta.url),'utf8'));
const programmes=JSON.parse(await readFile(new URL('../data/programmes.json',import.meta.url),'utf8'));
const year=String(Math.max(...influence.gifts.map(item=>Number(item.reported.split('.').at(-1)))));
const expected=influence.gifts.filter(item=>item.reported.endsWith(year)&&item.amount!=null&&item.amount>=500).sort((a,b)=>b.amount-a.amount);
assert.ok(expected.length,'The acceptance check needs actual gifts in the selected year');
const member=parliament.members.find(item=>String(item.id)===String(expected[0].mpId));
let browser;
const report={audits:[],screenshots:[],errors:[]};
try {
  await mkdir(output,{recursive:true});
  for(let attempt=0;attempt<50;attempt++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  for(const view of ['full','simple']){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
    page.on('pageerror',error=>report.errors.push(error.stack||error.message));
    const ready=()=>page.locator('main[aria-busy="false"] h1').waitFor();
    const visit=async route=>{await page.goto(`${url}/?view=${view}#/${route}`);await ready();};
    const giftCards=()=>page.locator(view==='full'?'.gift-card':'.easy-grid>.easy-card');
    const firstGift=async()=>{
      const card=giftCards().first();
      assert.ok((await card.innerText()).includes(expected[0].description),'Largest gift is first');
      assert.equal(await card.locator('a[href^="#/members/"]').first().getAttribute('href'),'#/members/'+expected[0].mpId);
    };
    const screenshot=async name=>{
      const file=view+'-'+name+'.png';
      await page.screenshot({path:fileURLToPath(new URL(file,output)),fullPage:false});report.screenshots.push(file);
    };
    const audit=async label=>{
      await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
      const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})).violations.map(item=>({id:item.id,nodes:item.nodes.slice(0,4).map(node=>({target:node.target,summary:node.failureSummary}))})));
      report.audits.push({label,violations});assert.deepEqual(violations,[],label);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' has no horizontal overflow');
    };
    await visit('influence');
    for(const selector of ['[data-influence-common="query"]','[data-influence-common="period"]','[data-influence-order]','[data-influence-min]']){
      const control=page.locator(selector);assert.equal(await control.isVisible(),true,selector+' is immediately available');
      assert.equal(await control.evaluate(element=>Boolean(element.closest('details:not([open])'))),false);
    }
    await page.locator('[data-influence-common="period"]').selectOption(year);
    const order=page.locator('[data-influence-order]');await order.focus();await order.selectOption('amount:desc');
    assert.equal(await order.evaluate(element=>element===document.activeElement),true,'Ordering retains focus');
    const minimum=page.locator('[data-influence-min]');await minimum.fill('500');await minimum.press('Tab');
    assert.equal(await minimum.inputValue(),'500');await firstGift();
    assert.match(await page.locator('.influence-selection').innerText(),new RegExp(`Vuosi ${year}.*Suurimmat lahjat ensin`));
    const shared=page.url();
    const recipient=await browser.newContext(),sharedPage=await recipient.newPage();
    await sharedPage.goto(shared);await sharedPage.locator('main[aria-busy="false"] h1').waitFor();
    assert.equal(await sharedPage.locator('[data-influence-common="period"]').inputValue(),year);
    assert.equal(await sharedPage.locator('[data-influence-order]').inputValue(),'amount:desc');
    assert.equal(await sharedPage.locator('[data-influence-min]').inputValue(),'500');
    assert.ok((await sharedPage.locator(view==='full'?'.gift-card':'.easy-grid>.easy-card').first().innerText()).includes(expected[0].description));
    await recipient.close();
    await page.locator('.view-toggle').click();await ready();
    assert.equal(await page.locator('[data-influence-order]').inputValue(),'amount:desc','Switching reading mode restores gift order');
    assert.equal(await page.locator('[data-influence-min]').inputValue(),'500');
    await page.locator('.view-toggle').click();await ready();await firstGift();
    await order.selectOption('amount:asc');
    const smallest=[...influence.gifts].filter(item=>item.reported.endsWith(year)&&item.amount!=null&&item.amount>=500).sort((a,b)=>a.amount-b.amount)[0];assert.ok((await giftCards().first().innerText()).includes(smallest.description),'Smallest eligible gift is first');
    await order.selectOption('amount:desc');
    await page.locator('[data-influence-common="query"]').fill('zzzz-no-record');
    assert.equal(await page.locator('[data-influence-common="query"]').evaluate(element=>element===document.activeElement),true,'Search retains focus');
    assert.equal(await giftCards().count(),0);await page.locator('[data-influence-common="query"]').fill('');
    if(view==='full'){
      await page.locator('[data-collection="influence"] [data-advanced]>summary').click();
      await page.locator('[data-facet="party"]>summary').click();
      await page.locator(`[data-facet="party"] [data-selection="include"][value="${expected[0].party}"]`).check();
      assert.ok(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).has('facets'));
      await page.locator('.view-toggle').click();await ready();
      assert.ok((await page.locator('.easy-grid>.easy-card').first().innerText()).includes(expected[0].description),'Simple view honours shared advanced filters');
      await page.locator('.view-toggle').click();await ready();
      await page.locator('[data-influence-clear]').click();
      assert.equal(await page.locator('[data-influence-common="period"]').inputValue(),'all');
      assert.equal(await minimum.inputValue(),'');
    }
    await visit('influence?tab=lobbying&period='+year+'&order=date%3Adesc');
    assert.equal(await order.inputValue(),'date:desc');
    assert.match(await page.locator('.influence-date-note').innerText(),/ilmoituskaud/);
    for(const sort of ['name:asc','topic:asc','targets:desc'])await order.selectOption(sort);
    assert.match(await order.innerText(),/Ilmoitettuja vastaanottajia/);

    await visit('members/'+member.id);await page.locator('[data-member-profile][aria-busy="false"]').waitFor();
    for(const section of ['member-votes','member-speeches','member-about']){
      await page.locator(`[data-member-jump="${section}"]`).focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('#'+section).evaluate(element=>element===document.activeElement),true,section+' receives keyboard focus');
      const visible=await page.locator('#'+section).evaluate(element=>element.getBoundingClientRect().top>=document.querySelector('.site-header').getBoundingClientRect().bottom-1);
      assert.equal(visible,true,'The section heading clears the sticky header');
    }
    assert.equal(await page.locator('[data-profile-education]').evaluate(element=>element.open),true);
    assert.equal(await page.locator('[data-profile-career]').evaluate(element=>element.open),true);
    assert.equal(await page.locator(`.member-profile .section-head a[href="${profiles.members[member.id].pageUrl}"]`).count(),1);
    assert.match(await page.locator('.profile-background').innerText(),/ei ole luettelo nykyisistä tehtävistä/);
    await page.locator('.member-tabs a[href^="#/influence/"]').click();await ready();
    const clear=page.locator(view==='full'?'[data-influence-clear]':'[data-easy-clear]');await clear.click();
    const cleared=page.url();await page.reload();await ready();
    assert.equal(page.url(),cleared,'Clearing a member filter remains shareable');
    await visit('influence/'+member.id);
    await page.locator(view==='full'?'[data-influence-tab="gifts"]':'[data-easy-influence-tab="gifts"]').click();
    const selectedName=`${member.firstName} ${member.lastName}`;
    assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('mp'),selectedName,'The MP’s gift tab keeps the selected person');
    assert.ok((await page.locator('.influence-selection').innerText()).includes(selectedName));
    assert.ok((await giftCards().allInnerTexts()).every(text=>text.includes(selectedName)));

    await visit('overview');
    const entry=page.locator('main a[href="#/programmes"]').filter({hasText:'Mitä puolueet lupaavat?'}).first();
    await entry.click();await ready();assert.match(await page.locator('main').innerText(),/2023/);
    const party=programmes.parties[0];await visit('parties/'+party.code);
    await page.locator(`main a[href="#/programmes?party=${party.code}"]`).click();await ready();
    const cards=page.locator(view==='full'?'.programme-card':'.easy-grid>.easy-card');assert.equal(await cards.count(),1);
    for(const programme of party.programmes){
      assert.equal(await cards.locator(`a[href="${programme.url}"]`).count(),1);
      const row=cards.locator('li').filter({has:page.locator(`a[href="${programme.url}"]`)});
      assert.match(await row.innerText(),new RegExp(String(programme.year)));assert.match(await row.innerText(),/Pohtiva/);
    }
    // The added controls and background are checked in FI/SV/EN before the theme matrix.
    for(const language of ['fi','sv','en']){
      await page.locator('.language-select').selectOption(language);await ready();
      await visit('influence');assert.equal(await order.isVisible(),true);assert.ok((await order.innerText()).includes({fi:'Suurimmat lahjat ensin',sv:'Största gåvor först',en:'Largest gifts first'}[language]));
      await visit('members/'+member.id);await page.locator('[data-member-profile][aria-busy="false"]').waitFor();
      assert.equal(await page.locator('[data-member-jump="member-about"]').innerText(),{fi:'Taustatiedot',sv:'Bakgrundsuppgifter',en:'Background'}[language]);
      assert.ok((await page.locator('[data-profile-education]').innerText()).includes({fi:'Koulutus',sv:'Utbildning',en:'Education'}[language]));
      const missing=parliament.members.find(item=>!profiles.members[item.id]?.education.length&&!profiles.members[item.id]?.career.fi.length);
      if(missing){
        await visit('members/'+missing.id);await page.locator('[data-member-profile][aria-busy="false"]').waitFor();
        assert.ok((await page.locator('[data-profile-education]').innerText()).includes({fi:'Koulutustietoja ei ole julkaistu.',sv:'Utbildningsuppgifter har inte publicerats.',en:'Education details have not been published.'}[language]));
        assert.ok((await page.locator('[data-profile-career]').innerText()).includes({fi:'Työhistoriaa ei ole julkaistu.',sv:'Arbetshistorik har inte publicerats.',en:'Employment history has not been published.'}[language]));
      }
    }
    await page.locator('.language-select').selectOption('fi');await ready();
    for(const theme of ['light','dark','contrast']){
      await page.locator('.theme-select').selectOption(theme);
      for(const logo of await page.locator('.brand-mark img').all())assert.equal((await logo.getAttribute('src')).endsWith('#contrast'),theme==='contrast','Both brand logos follow the theme');
      for(const width of [390,1440]){
        await page.setViewportSize({width,height:900});
        for(const route of ['members','influence','members/'+member.id,'programmes?party='+programmes.parties[0].code]){
          await visit(route);
          if(route.startsWith('members/'))await page.locator('[data-member-profile][aria-busy="false"]').waitFor();
          if(route==='members')for(const panel of await page.locator('[data-filter-panel]').all())await panel.evaluate(element=>{element.open=true});
          await audit(`${view} / ${theme} / ${width}px / ${route}`);
          if(route==='influence'){
            await page.locator('[data-influence-common="period"]').selectOption(year);await order.selectOption('amount:desc');
            await page.locator('[data-influence-common="query"]').scrollIntoViewIfNeeded();await screenshot(`${theme}-${width}-gifts`);
          }
          if(route.startsWith('members/')){
            await page.locator('[data-member-jump="member-about"]').click();await screenshot(`${theme}-${width}-background`);
          }
        }
      }
      // Header/footer logos get separate visual review at a practical desktop size.
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await screenshot(`${theme}-header`);
      await page.locator('footer').scrollIntoViewIfNeeded();await screenshot(`${theme}-footer`);
    }
    await context.close();console.log(view+': sharing, sort, period, minimum value, focus, profiles, dated programmes and all theme/size audits passed');
  }
  assert.deepEqual(report.errors,[],'No unhandled browser errors');
  console.log(`${report.audits.length} accessibility/layout audits passed. Screenshots: .hermes-tmp.improvements/`);
} finally {
  await writeFile(new URL('verification.json',output),JSON.stringify(report,null,2));
  await browser?.close();server?.kill();
}
