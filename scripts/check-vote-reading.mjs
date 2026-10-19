import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const data=JSON.parse(await readFile(new URL('../data/parliament.json',import.meta.url)));
const vote=data.votes.find(v=>v.id==='2026-100-2')||data.votes[0];
const ballots=data.ballots.filter(b=>(Array.isArray(b)?b[0]:b.voteId)===vote.id);
const port=process.env.VOTE_READING_PORT||'4209',base='http://localhost:'+port;
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:port},stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 await mkdir(new URL('../.hermes-tmp.vote-reading/',import.meta.url),{recursive:true});
 for(const view of ['simple','full'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?view='+view+'#/votes/'+encodeURIComponent(vote.id));
  const rows=view==='simple'?'[data-easy-voters] .easy-voter':'[data-voter-list]>li';await page.locator(rows).first().waitFor();
  assert.equal(await page.locator(rows).count(),ballots.length,'Every ballot must be on one page');
  assert.equal(await page.locator(rows+' .ballot-party').count(),ballots.length,'Each MP has a recorded party link');
  if(view==='simple'){
   assert.equal(await page.locator('[data-easy-voters] [data-easy-page]').count(),0);
   if(width===1440){assert.ok((await page.locator('.easy-vote-context').boundingBox()).height<280);assert.ok((await page.locator(rows).first().boundingBox()).height<85);}
  }
  const ai=page.locator('[data-ai-brief]');await ai.waitFor();
  assert.ok(await page.evaluate(()=>{const ai=document.querySelector('.ai-insights'),context=document.querySelector('.vote-summary,.easy-vote-context');return Boolean(context.compareDocumentPosition(ai)&Node.DOCUMENT_POSITION_FOLLOWING);}));
  await ai.locator(':scope>summary').click();await page.locator('[data-ai-language="fi"]').waitFor();
  if(width===1440)assert.ok((await ai.boundingBox()).height<420,'Opened brief stays compact');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator(view==='simple'?'[data-easy-voters]':'[data-voter-list]').scrollIntoViewIfNeeded();
  await page.screenshot({path:new URL('../.hermes-tmp.vote-reading/'+view+'-'+width+'.png',import.meta.url).pathname.replace(/^\/(.:)/,'$1')});
  assert.deepEqual(errors,[]);await context.close();
 }
 const page=await browser.newPage();
 for(const route of ['votes','members','legislation','programmes','elections','influence','budget']){
  await page.goto(base+'/?view=full#/'+route);await page.locator('main[aria-busy="false"] h1').waitFor();
  const panels=await page.locator('[data-filter-panel]').count();console.log(route+': '+panels+' filter panel(s)');
  assert.ok(panels<=1,route+' must combine its search and sort controls');
  if(['votes','members','legislation','budget'].includes(route)){
   const p=page.locator('[data-filter-panel]');assert.equal(await p.locator('[data-tool="sort"]').count(),1);assert.ok(await p.locator('input').count()>0);
  }
 }
 await page.setViewportSize({width:320,height:844});await page.goto(base+'/?view=full#/elections');await page.locator('[data-election-tab="candidates"]').click();await page.locator('[data-filter-panel]>summary').click();await page.locator('[data-advanced]>summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Opened candidate controls fit 320px');
 console.log('Vote reading checks passed: all ballots, party links, compact context/briefs, both views, mobile and unified controls.');
}finally{await browser?.close();server.kill();}

