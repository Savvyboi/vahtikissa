import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const url=process.env.BROWSER_TEST_URL||'http://localhost:4175',require=createRequire(import.meta.url);
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const output=new URL('../work/ui-review/',import.meta.url);await mkdir(output,{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:960},reducedMotion:'reduce',acceptDownloads:true}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const ready=()=>page.waitForFunction(()=>/^(Analyysi valmis\.|Analysen är klar\.|Analysis ready\.)$/.test(document.querySelector('.relationship-status')?.textContent));
  const noOverflow=async label=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label);
  await page.goto(`${url}/?view=full#/relationships?feature=vote-neighbours`);await ready();
  assert.equal(await page.locator('.relationship-subnav a[aria-current="page"]').count(),1);
  assert.equal(await page.locator('.relationship-agreement-list li').count(),12,'Default chart has a manageable initial size');
  assert.equal(await page.locator('.relationship-detail-table').getAttribute('open'),null,'Detailed metrics start collapsed');
  await page.locator('[data-neighbour-order]').selectOption('asc');
  const percentages=await page.locator('.relationship-agreement-value strong').allTextContents();
  const values=percentages.map(value=>Number(value.replace(/[^0-9,.]/g,'').replace(',','.')));
  assert.deepEqual(values,[...values].sort((a,b)=>a-b),'Least-alike chart uses ascending agreement');
  await page.locator('[data-neighbour-low]').check();
  const download=page.waitForEvent('download');await page.locator('[data-network-export="json"]').click();
  const {readFile}=await import('node:fs/promises');const exported=JSON.parse(await readFile(await(await download).path(),'utf8'));
  assert.ok(exported.some(row=>row.lowSupport),'Including small samples applies to export');
  assert.equal(JSON.parse(exported[0].filters).includeLowSupport,true,'Export records the support setting');
  await page.locator('[data-neighbour-low]').uncheck();await page.locator('[data-neighbour-order]').selectOption('desc');
  await page.locator('[data-neighbours-more]').click();
  assert.equal(await page.locator('.relationship-agreement-list li').count(),24,'Show more reveals more comparisons');
  await page.locator('[name="q"]').fill('no matching representative 123');
  await page.locator('.relationship-empty').waitFor();
  assert.equal(await page.locator('[data-compare-mp]').count(),0,'Empty results have no stale comparison');
  await page.locator('[name="q"]').fill('');await page.locator('[data-compare-mp]').waitFor();
  const options=await page.locator('[data-compare-mp] option').evaluateAll(nodes=>nodes.map(node=>node.value));
  await page.locator('[data-compare-mp]').selectOption(options.at(-1));
  assert.equal(await page.locator('.relationship-pair-card [data-other]').getAttribute('data-other'),options.at(-1),'Comparison evidence follows the selected person');
  await page.locator('.relationship-pair-card [data-pair]').click();await page.locator('dialog[open] [data-ballot-list]').waitFor();
  await page.keyboard.press('Escape');
  for(const width of [1280,390,320]){
    await page.goto(`${url}/?view=full#/relationships?feature=vote-neighbours`);await ready();
    await page.setViewportSize({width,height:960});await page.locator('h1').click();await noOverflow(`${width}px chart fits`);
    await page.screenshot({path:new URL(`relationships-${width}.png`,output).pathname.replace(/^\/(.:)/,'$1'),fullPage:true});
    if(width===1280)await page.screenshot({path:new URL('relationships-preview.png',output).pathname.replace(/^\/(.:)/,'$1')});
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');await noOverflow(`${width}px chart with 200% text fits`);
    await page.locator('[data-network-preset="party-heatmap"]').click();await ready();await noOverflow(`${width}px party matrix stays within its scroll region at 200% text`);
    await page.locator('[data-network-preset="topic-profiles"]').click();await ready();await noOverflow(`${width}px speech topics reflow at 200% text`);
    await page.locator('[data-network-preset="vote-neighbours"]').click();await ready();
    await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
  }
  await page.setViewportSize({width:1280,height:960});
  for(const feature of ['vote-neighbours','party-heatmap','topic-profiles']){
    await page.locator(`[data-network-preset="${feature}"]`).click();await ready();
    for(const theme of ['light','dark','contrast']){
      await page.locator('.theme-select').selectOption(theme);
      await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
      const violations=await page.evaluate(async()=> (await axe.run('main')).violations.map(row=>({id:row.id,nodes:row.nodes.map(node=>node.target)})));
      assert.deepEqual(violations,[],`${feature} ${theme}: accessibility`);
    }
  }
  assert.deepEqual(errors,[],'No runtime errors');
  console.log('Visual voting checks passed: chart order, support filter/export, pagination, empty states, comparison evidence, 320/390/1280px, 200% text, speech/party views, and axe in all themes.');
}finally{await browser.close();}
