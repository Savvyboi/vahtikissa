import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require=createRequire(import.meta.url),port=process.env.NETWORK_TEST_PORT||'4214',url=process.env.BROWSER_TEST_URL||`http://localhost:${port}`;
const server=process.env.BROWSER_TEST_URL?null:spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:port},windowsHide:true,stdio:'ignore'});
const manifest=process.env.BROWSER_TEST_URL?await fetch(new URL('data/networks/index.json',url+'/')).then(response=>{if(!response.ok)throw Error('Live relationship manifest is unavailable');return response.json();}):JSON.parse(await readFile(new URL('../data/networks/index.json',import.meta.url),'utf8'));
let browser;
try{
  for(let n=0;n<150;n++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  const context=await browser.newContext({viewport:{width:1280,height:950},reducedMotion:'reduce',acceptDownloads:true});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',r=>requests.push(new URL(r.url()).pathname));
  await page.goto(`${url}/?view=full#/overview`);await page.locator('main[aria-busy="false"] h1').waitFor();
  assert.equal(requests.some(p=>p.includes('/networks/')||p.endsWith('/relationships-app.js')),false,'Homepage keeps analytics lazy');
  await page.locator('.language-select').selectOption('en');await page.locator('main[aria-busy="false"] h1').waitFor();
  const menu=page.locator('.menu-button');if(await menu.isVisible()&&await menu.getAttribute('aria-expanded')!=='true')await menu.click();
  await page.locator('.nav [data-page="relationships"]').click();
  await page.locator('.relationship-subnav a[href*="feature=vote-neighbours"]').click();
  const ready=()=>page.waitForFunction(()=>/^(Analyysi valmis\.|Analysen är klar\.|Analysis ready\.)$/.test(document.querySelector('.relationship-status')?.textContent));
  const closeEvidence=async()=>{await page.locator('[data-evidence-close]').click();await page.locator('[data-network-evidence]').waitFor({state:'hidden'});};
  async function exportJSON(){
    // Avoid Chromium's burst-download throttle when exercising every feature.
    await page.waitForTimeout(150);
    const event=page.waitForEvent('download');await page.locator('[data-network-export="json"]').click();return JSON.parse(await readFile(await(await event).path(),'utf8'));
  }
  await ready();
  const feature=page.locator('[name="feature"]');
  async function selectFeature(id){
    const menu=page.locator('.relationship-analysis-menu');
    if(!await menu.evaluate(element=>element.open))await menu.locator('summary').click();
    await feature.selectOption(id);
  }
  assert.equal(await page.locator('.relationship-subnav a').count(),2,'The two relationship views remain available after navigation');
  assert.equal(await page.locator('.relationship-subnav [aria-current="page"]').getAttribute('href'),'#/relationships?feature=vote-neighbours','The analysis tab remains selected');
  for(const id of manifest.config.features){
    await selectFeature(id);await ready();
    assert.equal(await page.locator('[data-network-result] h2').count(),1,id+' has a heading');
    assert.equal(await page.locator('[data-network-result] table').count()>0,true,id+' has table equivalence');
    const exported=await exportJSON();
    assert.ok(exported.length,id+' export has rows or unavailable state');assert.equal(exported[0].manifestId,manifest.id);assert.equal(exported[0].feature,id);
    if(id==='directed-references')assert.match(await page.locator('[data-network-result]').innerText(),/Independent human evaluation is pending/);
    if(id==='communities')assert.match(await page.locator('[data-network-result]').innerText(),/assignments are withheld/);
    console.log(`Browser: ${id}, ${exported.length} exported rows.`);
  }
  await selectFeature('vote-neighbours');await ready();
  await page.locator('.relationship-detail-table > summary').click();
  const neighbourTable=page.locator('[data-network-result] table').first();
  const numericSort=neighbourTable.locator('[data-table-sort="2"]');
  await numericSort.focus();await page.keyboard.press('Enter');
  assert.equal(await numericSort.evaluate(el=>el===document.activeElement),true,'Sorting retains keyboard focus');
  assert.equal(await numericSort.locator('..').getAttribute('aria-sort'),'ascending');
  const ascending=await exportJSON();
  assert.deepEqual(ascending.map(r=>r.agreement),[...ascending.map(r=>r.agreement)].sort((a,b)=>a==null?1:b==null?-1:a-b),'Exports use numeric ascending order');
  await numericSort.click();
  const descending=await exportJSON();
  assert.deepEqual(descending.map(r=>r.agreement),[...descending.map(r=>r.agreement)].sort((a,b)=>a==null?1:b==null?-1:b-a),'Exports use numeric descending order');
  assert.deepEqual(await neighbourTable.locator('tbody tr td:nth-child(3)').allTextContents(),descending.slice(0,300).map(r=>r.agreement==null?'—':new Intl.NumberFormat('en-GB',{maximumFractionDigits:1}).format(r.agreement*100)+' %'),'Displayed percentages round to one decimal while exports retain source precision');
  assert.ok(Object.keys(JSON.parse(descending[0].filters).tableSort).length,'Exports include column sorting settings');
  await page.locator('[name="period"]').selectOption('year-2026');await ready();
  await selectFeature('network-explorer');await ready();
  const graphExport=await exportJSON();
  const graphFilters=JSON.parse(graphExport[0].filters);
  assert.equal(graphFilters.scope,'year-2026','Voting patterns honor the selected scope');
  assert.ok(graphExport.every(row=>row.party!==graphFilters.partyBaseline&&row.contestedCommon>=graphFilters.minimumContestedVotes),'Default lens compares supported cross-party patterns');
  await page.locator('.relationship-agreement-list [data-pair]').first().click();
  await page.locator('[data-ballot-list] table').waitFor();
  assert.match(await page.locator('[data-network-evidence]').innerText(),/2026/,'Voting evidence honors the selected scope');
  await closeEvidence();
  await page.locator('[data-voting-lens]').selectOption('same-party');
  const withinParty=await exportJSON();
  assert.equal(JSON.parse(withinParty[0].filters).lens,'same-party');
  assert.ok(withinParty.every(row=>row.status||(row.party===graphFilters.partyBaseline&&row.contestedDifferent>0)));
  await selectFeature('party-heatmap');await ready();
  await page.locator('.relationship-matrix [data-party-a]').first().click();await page.locator('[data-network-evidence] table').waitFor();
  assert.match(await page.locator('[data-network-evidence]').innerText(),/All contributing roll calls/);
  await closeEvidence();
  await selectFeature('cross-party-profiles');await ready();
  await page.locator('[data-cross-party]').first().click();await page.locator('[data-network-evidence] table').waitFor();
  assert.match(await page.locator('[data-network-evidence]').innerText(),/equal-event alignment/);
  await closeEvidence();
  await selectFeature('vote-neighbours');await ready();
  await page.locator('[data-pair]').first().focus();await page.keyboard.press('Enter');await page.locator('[data-ballot-list] table').waitFor();
  assert.match(await page.locator('[data-network-evidence]').innerText(),/All common eligible ballots/);
  await page.locator('[data-vote-file]').first().click();await page.locator('[data-network-evidence] blockquote, [data-network-evidence] h4').first().waitFor();
  await closeEvidence();
  await selectFeature('keyword-comparisons');await ready();
  assert.ok(await page.locator('[data-preset] option').count()>=30,'Keyword library includes a broad selection');
  assert.ok(await page.locator('.relationship-keyword-rates li').count()>1,'Default view compares groups');
  const speechTable=page.locator('[data-speech-results] table');
  await page.locator('[data-speech-results] details:has(table) > summary').click();
  await speechTable.locator('[data-table-sort="2"]').click();
  const speechRows=await exportJSON();
  assert.ok(speechRows.length>300,'Speech fixture exercises sorting beyond the initial display limit');
  assert.deepEqual(speechRows.map(r=>r.occurrences),[...speechRows.map(r=>r.occurrences)].sort((a,b)=>a-b),'Sort the full collection before showing the first 300 rows');
  const displayedMentions=await speechTable.locator('tbody tr td:nth-child(3)').allTextContents();
  assert.deepEqual(displayedMentions.map(Number),speechRows.slice(0,300).map(r=>r.occurrences),'Displayed rows match the complete sorted export');
  assert.equal(await speechTable.locator('tbody tr').filter({has:page.locator('td:nth-child(3)',{hasText:/^0$/})}).locator('[data-point]').count(),0,'Rows without matching source speeches do not offer a failing evidence action');
  await page.locator('.relationship-table [data-point]').first().click();await page.locator('[data-point-all]').waitFor();await page.locator('[data-point-all]').click();await page.locator('[data-network-evidence] table').waitFor();
  const speech=page.locator('[data-network-evidence] [data-speech]').first();if(await speech.count()){await speech.click();await page.locator('[data-network-evidence] blockquote').waitFor();}
  await closeEvidence();
  await page.locator('details:has([data-custom-speech]) > summary').click();
  await page.locator('[data-custom-speech] [name="query"]').fill('talous');
  const months=manifest.speechMonths.slice(-3);await page.locator('[data-custom-speech] [name="start"]').selectOption(months[0].month);
  await page.locator('[data-custom-speech] [name="exclude"]').fill('ilmasto');
  const customStarted=Date.now();await page.locator('[data-custom-speech] button').click();await ready();
  const customRows=await exportJSON(),customFilters=JSON.parse(customRows[0].filters);
  assert.equal(customFilters.query,'talous');assert.equal(customFilters.exclude,'ilmasto');assert.equal(customFilters.dateFrom,months[0].month+'-01');
  assert.equal(await page.locator('[data-preset]').inputValue(),'custom','Custom results are labelled as custom');
  await page.locator('[name="q"]').fill('KOK');await page.waitForFunction(()=>new URLSearchParams(location.hash.split('?')[1]).get('q')==='KOK');await ready();
  const retained=await exportJSON();assert.equal(JSON.parse(retained[0].filters).query,'talous','Table filtering retains the calculated custom query');
  await page.locator('[name="q"]').fill('');await page.waitForFunction(()=>new URLSearchParams(location.hash.split('?')[1]).get('q')==='');await ready();
  console.log(`Custom three-month speech calculation and export: ${Date.now()-customStarted} ms including loading, ${(months.reduce((n,m)=>n+m.bytes,0)/1e6).toFixed(2)} MB selected corpus.`);
  await selectFeature('phrase-uptake');await ready();await page.locator('details:has([data-custom-speech]) > summary').click();await page.locator('[data-custom-speech] [name="query"]').fill('talous');await page.locator('[data-custom-speech] button').click();await ready();
  assert.match(await page.locator('[data-speech-results]').innerText(),/First observed use in the selected searched window/);
  await selectFeature('committee-overlap');await ready();
  await page.locator('[data-committee-dates] [name="from"]').fill('2025-01-01');await page.locator('[data-committee-dates] button').click();await ready();
  const committeeExport=await exportJSON();assert.equal(JSON.parse(committeeExport[0].filters).from,'2025-01-01');
  await page.locator('[data-committee-pair]').first().click();await page.locator('[data-network-evidence] pre').waitFor();assert.match(await page.locator('[data-network-evidence]').innerText(),/membershipRecords/);
  await closeEvidence();
  await selectFeature('lobbying-network');await ready();await page.locator('[data-lobby-table] [data-table-sort="1"]').click();await page.locator('[data-declaration]').first().click();await page.locator('[data-network-evidence] pre').waitFor();assert.match(await page.locator('[data-network-evidence]').innerText(),/Original declaration rows/);
  await closeEvidence();
  const lobbyingExport=await exportJSON();assert.ok(JSON.parse(lobbyingExport[0].filters).organisationId);
  await selectFeature('committee-overlap');await ready();
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  for(const theme of ['light','dark','contrast']){
    await page.locator('.theme-select').selectOption(theme);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const violations=await page.evaluate(async()=> (await axe.run('.relationships-page')).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
    assert.deepEqual(violations,[],`Relationships ${theme} accessibility`);
  }
  await mkdir(new URL('../.hermes-tmp.networks/',import.meta.url),{recursive:true});
  await page.screenshot({path:fileURLToPath(new URL('../.hermes-tmp.networks/relationships-desktop.png',import.meta.url)),fullPage:false});
  for(const width of [320,390]){
    await page.setViewportSize({width,height:850});
    for(const id of manifest.config.features){await selectFeature(id);await ready();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`${id}: no horizontal page overflow at ${width}`);}
  }
  await page.screenshot({path:fileURLToPath(new URL('../.hermes-tmp.networks/relationships-mobile.png',import.meta.url)),fullPage:false});
  for(const lang of ['fi','sv','en']){
    await page.locator('.language-select').selectOption(lang);await page.locator('main[aria-busy="false"] h1').waitFor();assert.equal(await feature.count(),1);
    for(const id of manifest.config.features){
      await selectFeature(id);await page.waitForFunction(()=>/Analyysi valmis\.|Analysen är klar\.|Analysis ready\./.test(document.querySelector('.relationship-status')?.textContent));
      const headers=await page.locator('[data-network-result] th').allTextContents();
      assert.doesNotMatch(await page.locator('[data-network-result]').innerText(),/\d[.,]\d{2,}\s*%/,lang+' '+id+' displays at most one decimal place in percentages');
      if(lang!=='en')assert.equal(headers.some(text=>/Yes\/no|Contested|Matter %|Session %|Shared body-days|Recorded party baseline|Candidate passage|Per 10,000|Share of MP|Evidence/.test(text)),false,lang+' '+id+' translates table headings');
      assert.ok(await page.locator('[data-network-result] [data-table-sort]').count(),lang+' '+id+' has sortable columns');
    }
  }
  await page.goto(`${url}/?view=full#/members/${manifest.members[0].id}`);await page.locator('[data-pagination="memberVotes"]').waitFor();
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:950});
    for(const theme of ['light','dark','contrast']){
      await page.locator('.theme-select').selectOption(theme);
      // Chromium can expose the preceding theme's paint immediately after change.
      // Measure contrast after the new theme has been painted, in every browser.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const numbers=page.locator('.pagination button[data-page]').filter({hasText:/^\d+$/});
      assert.equal(await numbers.first().evaluate(button=>getComputedStyle(button).transitionDuration),'0s','Reduced motion must disable transitions, including on otherwise unanimated controls');
      const unreadable=await numbers.evaluateAll(buttons=>{
        const luminance=rgb=>{const c=rgb.match(/[\d.]+/g).slice(0,3).map(x=>Number(x)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
        return buttons.flatMap(button=>{const s=getComputedStyle(button),a=luminance(s.color),b=luminance(s.backgroundColor),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return ratio<4.5||s.fontSize==='0px'||s.visibility==='hidden'||s.opacity==='0'?[{text:button.textContent,color:s.color,background:s.backgroundColor,ratio}]:[];});
      });
      assert.deepEqual(unreadable,[],`${width} ${theme}: numbered pagination buttons are readable`);
    }
  }
  const next=page.locator('[data-pagination="memberVotes"]').getByRole('button',{name:'Page 2',exact:true});
  const firstVote=await page.locator('[data-member-votes] .row-link').first().getAttribute('href');
  await next.click();assert.equal(await page.locator('[data-pagination="memberVotes"] [aria-current]').innerText(),'2');
  assert.notEqual(await page.locator('[data-member-votes] .row-link').first().getAttribute('href'),firstVote,'Number buttons switch the actual MP vote page');
  await page.locator('.theme-select').selectOption('light');await page.locator('.language-select').selectOption('fi');
  await page.goto(`${url}/?view=full#/votes`);await page.locator('[data-list] .vote-reference').first().waitFor();
  assert.match(await page.locator('[data-list]').innerText(),/Äänestys \d{4}-\d+-\d+/,'Vote lists distinguish roll calls');
  assert.ok(await page.locator('[data-list] .vote-question').count(),'Vote alternatives are visible on the list');
  const committee=page.locator('.committee-tag').first();await committee.locator('summary').click();assert.equal(await committee.getAttribute('open'),'','Committee acronyms expand on tap');
  await page.goto(`${url}/?view=simple#/relationships?feature=party-heatmap`);await ready();assert.ok(await page.locator('.relationship-table').count());
  const metrics=await page.evaluate(()=>({bytes:performance.getEntriesByType('resource').filter(r=>r.name.includes('/networks/')).reduce((n,r)=>n+r.decodedBodySize,0)}));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${url}/?view=full#/relationships?feature=vote-neighbours`);await ready();
  await page.locator('.relationship-detail-table > summary').click();
  await page.locator('[data-network-result] [data-table-sort="2"]').first().click();
  await page.screenshot({path:fileURLToPath(new URL('../.hermes-tmp.networks/relationships-sorted-fi.png',import.meta.url)),fullPage:false});

  const votePayload='**/all-member-*.json';
  await page.route(votePayload,route=>route.abort());
  await page.reload();
  await page.locator('.relationship-status').filter({hasText:/Analyysi ei ole saatavilla/}).waitFor();
  assert.notEqual(await page.locator('[data-network-result]').getAttribute('aria-busy'),'true','A failed analysis clears its busy state');
  await page.locator('[data-network-preset="party-heatmap"]').click();await ready();
  assert.equal(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('feature'),'party-heatmap','Quick views still work after a request fails');
  await page.unroute(votePayload);

  await page.evaluate(()=>{
    const query=document.querySelector('[data-network-form] [name="q"]');
    query.value='pending filter';
    query.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('.relationship-subnav a[href="#/relationships"]').click();
  });
  await page.locator('[data-sna-page]').waitFor();
  await page.waitForTimeout(250); // Wait past the detached analysis form's debounce.
  assert.equal(new URL(page.url()).hash,'#/relationships','Pending analysis input does not rewrite the map URL');
  assert.equal(await page.locator('main').getAttribute('data-route'),'#/relationships','The rendered view and route stay synchronized');
  assert.deepEqual(errors,[],'No runtime errors');
  console.log(`Relationships browser checks passed; initial simple heatmap data ${(metrics.bytes/1e6).toFixed(2)} MB.`);
  await context.close();
}finally{await browser?.close();server?.kill();}
