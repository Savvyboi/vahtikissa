import {readFile,writeFile,rename,appendFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const DAILY_REQUEST_LIMIT=950;
export const BATCH_REQUEST_LIMIT=150;
export const REQUEST_DELAY_MS=4100;
const utcDay=now=>new Date(now).toISOString().slice(0,10);
const exhausted=message=>Object.assign(new Error(message),{code:'AI_REQUEST_BUDGET_EXHAUSTED'});
async function readLedger(file){
 try{
  const state=JSON.parse(await readFile(file,'utf8'));
  if(state.version!==1 || !/^\d{4}-\d{2}-\d{2}$/.test(state.day) || !Number.isFinite(Date.parse(state.day+'T00:00:00Z')) || !Number.isInteger(state.used) || state.used<0 || !Array.isArray(state.reservations))throw Error('Invalid AI daily request ledger');
  const ids=new Set();let accounted=0;
  for(const row of state.reservations){
   if(typeof row.id!=='string'||ids.has(row.id)||!Number.isInteger(row.allocated)||row.allocated<1||row.allocated>BATCH_REQUEST_LIMIT||!(row.actual===null||Number.isInteger(row.actual)&&row.actual>=0&&row.actual<=row.allocated))throw Error('Invalid AI request reservation');
   ids.add(row.id);accounted+=row.actual??row.allocated;
  }
  if(accounted>state.used)throw Error('AI daily ledger undercounts reserved requests');
  return state;
 }catch(error){if(error.code==='ENOENT')return null;throw error;}
}
async function save(file,state){const temp=new URL(file.href+'.tmp');await writeFile(temp,JSON.stringify(state)+'\n');await rename(temp,file);}
export async function reserveDailyRequests({file,apiKey,requested=BATCH_REQUEST_LIMIT,fetchImpl=fetch,now=Date.now,id=randomUUID()}={}){
 if(!apiKey)throw Error('OPENROUTER_API_KEY is required for quota verification');
 if(!Number.isInteger(requested)||requested<1||requested>BATCH_REQUEST_LIMIT)throw Error('Batch requests must be an integer from 1 to '+BATCH_REQUEST_LIMIT);
 const response=await fetchImpl('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+apiKey},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('OpenRouter quota check HTTP '+response.status);
 const quota=(await response.json()).data?.free_model_daily_requests;
 if(!quota||!['used','limit','remaining'].every(k=>Number.isInteger(quota[k])&&quota[k]>=0))throw Error('OpenRouter free-request quota is unavailable; no requests reserved');
 if(quota.limit<DAILY_REQUEST_LIMIT)throw Error('OpenRouter daily allowance is '+quota.limit+'; the configured 950-request plan requires an eligible account');
 const time=now(),day=utcDay(time),previous=await readLedger(file);
 const previousJSON=JSON.stringify(previous);
 const state=previous?.day===day?previous:{version:1,day,used:0,reservations:[]};
 state.used=Math.max(state.used,quota.used); // Includes earlier runs and other uses of the account.
 if(state.reservations.some(row=>row.id===id))throw Error('AI request reservation ID already exists');
 const allocated=Math.max(0,Math.min(requested,DAILY_REQUEST_LIMIT-state.used,quota.remaining));
 if(allocated){state.used+=allocated;state.reservations.push({id,allocated,actual:null,startedAt:new Date(time).toISOString()});}
 if(previousJSON!==JSON.stringify(state))await save(file,state);
 return {id:allocated?id:'',requests:allocated,day,used:state.used,providerUsed:quota.used,providerLimit:quota.limit};
}
export async function openDailyReservation({file,id,now=Date.now,maxDurationMs=50*60000}={}){
 const state=await readLedger(file),row=state?.reservations.find(row=>row.id===id);
 if(!row||row.actual!==null)throw Error('Missing or settled AI request reservation');
 const start=now();let attempts=0;
 return {
  requests:row.allocated,
  beforeRequest(){
   if(utcDay(now())!==state.day)throw exhausted('UTC day changed; completed results retained for the next batch');
   if(now()-start>=maxDurationMs)throw exhausted('AI batch time window reached; completed results retained');
   if(attempts>=row.allocated)throw exhausted('Daily request reservation exhausted');
   attempts++;
  },
  async settle(actual){
   if(!Number.isInteger(actual)||actual<0||actual>row.allocated)throw Error('Invalid settled AI request count');
   const latest=await readLedger(file);
   if(latest.day!==state.day)throw Error('AI request ledger day changed unexpectedly');
   const current=latest.reservations.find(entry=>entry.id===id);
   if(!current||current.actual!==null)throw Error('AI request reservation already settled');
   latest.used-=current.allocated-actual;current.actual=actual;current.settledAt=new Date(now()).toISOString();
   await save(file,latest);
  }
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const requested=Number(process.env.AI_MAX_REQUESTS||BATCH_REQUEST_LIMIT);
 reserveDailyRequests({file:new URL('../data/ai-request-budget.json',import.meta.url),apiKey:process.env.OPENROUTER_API_KEY,requested}).then(async plan=>{
  console.log('Daily AI budget: '+plan.used+'/'+DAILY_REQUEST_LIMIT+' used or reserved for '+plan.day+' UTC; '+plan.requests+' requests allocated; provider allowance '+plan.providerLimit+'.');
  if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'requests='+plan.requests+'\nreservation='+plan.id+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'\nDaily free-model budget: '+plan.used+'/'+DAILY_REQUEST_LIMIT+' used or reserved ('+plan.day+' UTC). This batch: '+plan.requests+' requests.\n');
 }).catch(error=>{console.error(error.message);process.exitCode=1;});
}
