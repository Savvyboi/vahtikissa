import {readFile,appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {DAILY_REQUEST_LIMIT,BATCH_REQUEST_LIMIT} from './ai-request-budget.mjs';

export function nextBatchPlan({ledger,reservationId,pending=true,now=Date.now()}={}){
 const reservation=ledger?.reservations?.find(row=>row.id===reservationId);
 if(!reservation||!Number.isInteger(reservation.actual)||reservation.actual<=0)return {continue:false,reason:'No settled model requests; leaving recovery to the scheduled trigger.'};
 if(!pending)return {continue:false,reason:'The backfill is complete.'};
 if(!Number.isInteger(ledger.used)||ledger.used<0)throw Error('Invalid AI request ledger');
 const day=new Date(now).toISOString().slice(0,10);
 const remaining=ledger.day===day?Math.max(0,DAILY_REQUEST_LIMIT-ledger.used):DAILY_REQUEST_LIMIT;
 if(!remaining)return {continue:false,reason:'The daily 950-request budget has been reached.'};
 return {continue:true,requests:Math.min(BATCH_REQUEST_LIMIT,remaining),reason:'Backfill pending with '+remaining+' requests left in the daily budget.'};
}

export async function continueBackfill({ledger,reservationId,pending=true,repository,token,fetchImpl=fetch,now=Date.now()}={}){
 const plan=nextBatchPlan({ledger,reservationId,pending,now});
 if(!plan.continue)return plan;
 if(!/^[\w.-]+\/[\w.-]+$/.test(repository||'')||!token)throw Error('GitHub repository and workflow token are required');
 const response=await fetchImpl('https://api.github.com/repos/'+repository+'/actions/workflows/daily-ai-sync.yml/dispatches',{
  method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
  body:JSON.stringify({ref:'main',inputs:{max_requests:String(plan.requests),refresh_programmes:false}}),signal:AbortSignal.timeout(30000)
 });
 if(response.status!==204)throw Error('Next AI batch dispatch HTTP '+response.status);
 return {...plan,reason:plan.reason+' Next batch dispatched ('+plan.requests+' requests, subject to a fresh quota check).'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const ledger=JSON.parse(await readFile(new URL('../data/ai-request-budget.json',import.meta.url),'utf8'));
 continueBackfill({ledger,reservationId:process.env.AI_BUDGET_RESERVATION,pending:process.env.AI_BACKFILL_PENDING!=='false',repository:process.env.GH_REPOSITORY,token:process.env.GH_TOKEN}).then(async plan=>{
  console.log(plan.reason);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'\n'+plan.reason+'\n');
 }).catch(error=>{console.error(error.message);process.exitCode=1;});
}
