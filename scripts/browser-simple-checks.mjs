import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);

export async function checkSimpleMode(browser,url){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.stack||error.message));
  const parliament=JSON.parse(await readFile(new URL('../data/parliament.json',import.meta.url),'utf8'));
  const base=url.replace(/\/$/,'');
  const ready=async(route,view='simple')=>{
    await page.waitForFunction(({route,view})=>{
      const main=document.querySelector('main');
      return main?.dataset.route===('#/'+route)&&main.dataset.view===view&&main.getAttribute('aria-busy')==='false'&&main.querySelector('h1');
    },{route,view});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  };
  const navigate=async route=>{await page.evaluate(route=>{location.hash='#/'+route},route);await ready(route)};
  const audit=async label=>{
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const findings=await page.evaluate(async()=>{
      const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});
      return result.violations.map(item=>({id:item.id,nodes:item.nodes.slice(0,3).map(node=>({target:node.target,summary:node.failureSummary}))}));
    });
    assert.deepEqual(findings,[],label+' accessibility');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' horizontal overflow');
  };
  try{
    await page.goto(base+'/?view=simple#/overview');await ready('overview');
    assert.equal(await page.locator('.view-toggle').getAttribute('aria-checked'),'true');
    assert.equal(await page.locator('main .collection-tools').count(),0,'Simple mode has its own uncluttered controls');
    await mkdir(new URL('../.hermes-tmp.simple/',import.meta.url),{recursive:true});
    await page.screenshot({path:new URL('../.hermes-tmp.simple/overview-desktop.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});

    await page.locator('[data-easy-home-topic]').selectOption('economy');
    await page.locator('[data-easy-topic-target="votes"]').first().click();await ready('votes?topic=economy');
    const topic=page.locator('main [data-easy-filter="topic"]');
    assert.equal(await topic.inputValue(),'economy','Home topics select the matching list filter');
    await topic.selectOption('defence');await ready('votes?topic=defence');
    assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('topic'),'defence','Changing a topic updates the shareable URL');
    await page.locator('.easy-results .easy-card h3 a').first().click();await ready(new URL(page.url()).hash.slice(2));
    await page.goBack();await ready('votes?topic=defence');
    assert.equal(await topic.inputValue(),'defence','Returning from a vote retains the selected topic');
    await page.locator('[data-easy-clear]').click();await ready('votes?topic=all');
    assert.equal(await topic.inputValue(),'all','Clearing filters updates both the URL and controls');
    await topic.selectOption('defence');await navigate('overview');
    await page.locator('[data-easy-home-topic]').selectOption('all');
    await page.locator('[data-easy-topic-target="votes"]').first().click();await ready('votes?topic=all');
    assert.equal(await topic.inputValue(),'all','The home All topics choice clears a previous list topic');

    await navigate('votes');
    const search=page.locator('main input[type="search"]').first();
    await search.fill('zzzz-no-matching-record');
    await page.locator('.easy-empty').waitFor();
    await navigate('members');await navigate('votes');
    assert.equal(await search.inputValue(),'zzzz-no-matching-record','Returning to a list keeps its search');
    await search.fill('');
    await page.locator('.easy-pagination button:not([disabled])').first().click();
    assert.ok(await page.locator('.easy-results').innerText(),'Pagination leaves usable results');

    await page.locator('[data-easy-clear]').click();await navigate('votes');
    await page.evaluate(()=>window.scrollTo({top:620,behavior:'instant'}));
    await page.locator('.view-toggle').click();await ready('votes','full');
    assert.equal(await page.evaluate(()=>scrollY),620,'Turning simple mode off keeps the reading position');
    await page.locator('.view-toggle').click();await ready('votes');
    assert.equal(await page.evaluate(()=>scrollY),620,'Turning simple mode on keeps the reading position');
    const detail='votes/'+encodeURIComponent(parliament.votes[0].id);
    await navigate(detail);
    const hash=new URL(page.url()).hash;
    await page.locator('.view-toggle').click();await ready(detail,'full');
    assert.equal(new URL(page.url()).hash,hash,'Changing modes keeps the exact vote');
    assert.equal(await page.evaluate(()=>localStorage.getItem('vahtikissa-view')),'full');
    await page.locator('.view-toggle').click();await ready(detail);
    assert.equal(new URL(page.url()).searchParams.get('view'),'simple');
    await page.reload();await ready(detail);
    await page.goto(base+'/#/members');await ready('members');
    await page.goto(base+'/?view=full#/members');await ready('members','full');
    assert.equal(await page.locator('.view-toggle').getAttribute('aria-checked'),'false','An explicit full URL overrides the saved simple choice');
    await page.locator('.view-toggle').click();await ready('members');

    for(const language of ['fi','sv','en']){
      await page.locator('.language-select').selectOption(language);
      for(const viewport of [{width:320,height:568},{width:844,height:390},{width:1024,height:768},{width:1440,height:1000},{width:1920,height:1080}]){
        await page.setViewportSize(viewport);
        const menu=page.locator('.menu-button');
        if(await menu.isVisible()&&await menu.getAttribute('aria-expanded')!=='true')await menu.click();
        const links=page.locator('.nav > a:visible');
        assert.equal(await links.count(),7,'Simple mode keeps seven primary sections');
        const boxes=await links.evaluateAll(items=>items.map(item=>{const r=item.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,text:item.textContent}}));
        for(const box of boxes)assert.ok(box.left>=0&&box.right<=viewport.width+1&&box.top>=0&&box.bottom<=viewport.height,language+' menu at '+viewport.width+': '+box.text);
        if(await menu.isVisible())await page.keyboard.press('Escape');
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('.language-select').selectOption('fi');
    const routes=['overview','votes','members','speeches','legislation','sessions','parties','budget','influence','elections','programmes','about',
      detail,'members/'+parliament.members[0].id,'speeches/'+encodeURIComponent(parliament.speeches[0].id),
      'legislation/'+encodeURIComponent(parliament.legislation.find(item=>item.voteIds.length)?.id)];
    for(const language of ['fi','sv','en']){
      await page.locator('.language-select').selectOption(language);
      for(const route of routes){await navigate(route);await audit(language+' / simple / desktop / '+route)}
    }
    for(const theme of ['dark','contrast']){
      await page.locator('.theme-select').selectOption(theme);
      for(const route of ['overview','votes','budget','influence',detail]){await navigate(route);await audit(theme+' / simple / '+route)}
    }
    await page.locator('.theme-select').selectOption('light');await page.locator('.language-select').selectOption('fi');
    await page.setViewportSize({width:320,height:740});
    for(const route of ['overview','votes','members','speeches','legislation','budget','influence','elections','programmes']){
      await navigate(route);await audit('320px / simple / '+route);
    }
    await navigate('overview');
    await page.screenshot({path:new URL('../.hermes-tmp.simple/overview-mobile.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
    assert.deepEqual(errors,[],'Simple mode has no unhandled browser errors');
    console.log('Simple mode: shared URLs, persistence, switching details, search retention, pagination, all pages in FI/SV/EN, mobile and theme accessibility passed.');
  }finally{await context.close()}
}