import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {reserveDailyRequests,openDailyReservation,DAILY_REQUEST_LIMIT,BATCH_REQUEST_LIMIT,REQUEST_DELAY_MS} from '../scripts/ai-request-budget.mjs';
const quota=(used=0,limit=1000)=>async()=>({ok:true,json:async()=>({data:{free_model_daily_requests:{used,limit,remaining:limit-used}}})});
async function fixture(run){const dir=await mkdtemp(join(tmpdir(),'vahti-ai-quota-'));try{await run(new URL('budget.json',pathToFileURL(dir+'/')));}finally{await rm(dir,{recursive:true,force:true});}}
test('daily reservations respect account usage, refund unused requests and retain cancelled allocations',()=>fixture(async file=>{
 let time=Date.parse('2026-10-19T12:00:00Z');const options={file,apiKey:'test',now:()=>time};
 const first=await reserveDailyRequests({...options,requested:150,fetchImpl:quota(400),id:'first'});
 assert.equal(first.requests,75);assert.equal(first.used,475);
 const active=await openDailyReservation({file,id:first.id,now:()=>time});
 assert.equal(active.refreshProgrammes,true);await active.markProgrammesReady();
 for(let i=0;i<10;i++)active.beforeRequest();
 await active.settle(10);
 assert.equal(JSON.parse(await readFile(file)).used,410);
 const second=await reserveDailyRequests({...options,fetchImpl:quota(410),id:'cancelled'});assert.equal(second.requests,65);
 assert.equal((await openDailyReservation({file,id:second.id,now:()=>time})).refreshProgrammes,false);
 // A cancelled runner cannot refund its reservation: the next run remains capped.
 const next=await reserveDailyRequests({...options,fetchImpl:quota(410),id:'next'});assert.equal(next.requests,0);
 time+=86400000;
 const tomorrow=await reserveDailyRequests({...options,fetchImpl:quota(2),id:'tomorrow'});assert.equal(tomorrow.requests,150);assert.equal(tomorrow.used,152);
 assert.equal(JSON.parse(await readFile(file)).reservations.length,1);
}));
test('lowering the cap preserves same-day usage already above the new limit',()=>fixture(async file=>{
 const now=()=>Date.parse('2026-10-19T12:00:00Z');
 const previous={version:1,day:'2026-10-19',used:950,reservations:[{id:'earlier',allocated:150,actual:150}]};
 await writeFile(file,JSON.stringify(previous));
 const plan=await reserveDailyRequests({file,apiKey:'test',now,fetchImpl:quota(900)});
 assert.equal(plan.requests,0);
 assert.equal(plan.used,950);
 assert.deepEqual(JSON.parse(await readFile(file)),previous);
}));
test('daily reservation guards count attempts, stop at midnight and stop before the job timeout',()=>fixture(async file=>{
 let time=Date.parse('2026-10-19T23:59:00Z');const options={file,apiKey:'test',requested:2,fetchImpl:quota(),now:()=>time,id:'guard'};
 await reserveDailyRequests(options);let guard=await openDailyReservation({file,id:'guard',now:()=>time,maxDurationMs:30000});
 guard.beforeRequest();guard.beforeRequest();assert.throws(()=>guard.beforeRequest(),e=>e.code==='AI_REQUEST_BUDGET_EXHAUSTED');
 guard=await openDailyReservation({file,id:'guard',now:()=>time,maxDurationMs:30000});time+=31000;assert.throws(()=>guard.beforeRequest(),/time window/);
 guard=await openDailyReservation({file,id:'guard',now:()=>time});time+=60000;assert.throws(()=>guard.beforeRequest(),/UTC day/);
}));
test('unknown quota and corrupt ledger fail closed without reserving model calls',()=>fixture(async file=>{
 const options={file,apiKey:'test',id:'bad'};
 await assert.rejects(reserveDailyRequests({...options,fetchImpl:async()=>({ok:true,json:async()=>({data:{}})})}),/quota is unavailable/);
 await assert.rejects(reserveDailyRequests({...options,fetchImpl:quota(0,50)}),/eligible account/);
 await writeFile(file,'{"version":1,"day":"2026-10-19","used":0,"reservations":[{"id":"held","allocated":150,"actual":null}]}');
 await assert.rejects(reserveDailyRequests({...options,fetchImpl:quota()}),/undercounts/);
 await writeFile(file,'broken');await assert.rejects(reserveDailyRequests({...options,fetchImpl:quota()}),SyntaxError);
}));
test('475 daily requests and 4100 ms pacing leave headroom under the provider limits',()=>{
 assert.equal(DAILY_REQUEST_LIMIT,475);assert.equal(BATCH_REQUEST_LIMIT,150);assert.ok(REQUEST_DELAY_MS>=4001);
 assert.ok(Math.floor(59999/REQUEST_DELAY_MS)+1<=15);
});
