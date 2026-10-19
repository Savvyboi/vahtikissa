import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {nextBatchPlan,continueBackfill} from '../scripts/continue-ai-backfill.mjs';
import {reserveDailyRequests,openDailyReservation} from '../scripts/ai-request-budget.mjs';
const now=Date.parse('2026-10-20T12:00:00Z');
const ledger=(used,actual=150)=>({version:1,day:'2026-10-20',used,reservations:[{id:'batch',allocated:150,actual}]});

test('saved batches immediately dispatch the next batch, bounded by remaining daily quota',async()=>{
 const calls=[];
 const options={reservationId:'batch',repository:'Savvyboi/vahtikissa',token:'test-token',now,fetchImpl:async(url,request)=>{calls.push({url,request});return {status:204};}};
 const next=await continueBackfill({...options,ledger:ledger(598)});
 assert.equal(next.continue,true);assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.github.com/repos/Savvyboi/vahtikissa/actions/workflows/daily-ai-sync.yml/dispatches');
 assert.deepEqual(JSON.parse(calls[0].request.body),{ref:'main',inputs:{max_requests:'150',refresh_programmes:false}});
 const last=await continueBackfill({...options,ledger:ledger(898)});
 assert.equal(last.requests,52);assert.equal(JSON.parse(calls[1].request.body).inputs.max_requests,'52');
 assert.equal((await continueBackfill({...options,ledger:ledger(950)})).continue,false);
 assert.equal(calls.length,2);
});

test('completed backfills and zero-progress or unsettled batches do not create dispatch loops',async()=>{
 const options={reservationId:'batch',now,fetchImpl:()=>{throw Error('Unexpected dispatch');}};
 for(const state of [ledger(300,0),ledger(300,null),ledger(300,-1),{...ledger(300),reservations:[]}]){
  assert.equal((await continueBackfill({...options,ledger:state})).continue,false);
 }
 assert.equal((await continueBackfill({...options,ledger:ledger(300),pending:false})).continue,false);
 assert.equal(nextBatchPlan({...options,ledger:ledger(300),reservationId:'wrong'}).continue,false);
 assert.throws(()=>nextBatchPlan({...options,ledger:ledger(-1)}),/Invalid AI request ledger/);
});

test('continuation handles UTC rollover and reports a rejected handoff',async()=>{
 const state={...ledger(950),day:'2026-10-19'};
 assert.equal(nextBatchPlan({ledger:state,reservationId:'batch',now}).requests,150);
 await assert.rejects(continueBackfill({ledger:ledger(300),reservationId:'batch',now,repository:'Savvyboi/vahtikissa',token:'test-token',fetchImpl:async()=>({status:403})}),/dispatch HTTP 403/);
});

test('chained batches spend exactly 950 requests including a partially failed batch, then reset on the next UTC day',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vahti-ai-chain-'));
 try{
  const file=new URL('budget.json',pathToFileURL(dir+'/'));let used=0,time=now,batch=0;
  do{
   const id='batch-'+batch;
   const reservation=await reserveDailyRequests({file,id,apiKey:'test',now:()=>time,fetchImpl:async()=>({ok:true,json:async()=>({data:{free_model_daily_requests:{used,limit:1000,remaining:1000-used}}})})});
   const guard=await openDailyReservation({file,id,now:()=>time});
   // A provider failure after 64 requests retains progress and refunds the unused reservation.
   const actual=batch===0?64:reservation.requests;
   for(let i=0;i<actual;i++)guard.beforeRequest();
   await guard.settle(actual);used+=actual;batch++;
   const state=JSON.parse(await readFile(file,'utf8'));
   const plan=nextBatchPlan({ledger:state,reservationId:id,now:time});
   assert.equal(state.used,used);assert.ok(state.used<=950);
   if(!plan.continue){assert.equal(used,950);break;}
   assert.ok(batch<10);
  }while(true);
  assert.equal(batch,7);
  time+=86400000;used=0;
  const tomorrow=await reserveDailyRequests({file,id:'tomorrow',apiKey:'test',now:()=>time,fetchImpl:async()=>({ok:true,json:async()=>({data:{free_model_daily_requests:{used,limit:1000,remaining:1000}}})})});
  assert.equal(tomorrow.requests,150);assert.equal(tomorrow.day,'2026-10-21');
 }finally{await rm(dir,{recursive:true,force:true});}
});
