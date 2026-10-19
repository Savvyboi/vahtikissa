import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_AI_MODEL, recordSource, sourceFingerprint, emptyInsights, currentInsight, insightTags, matchesAITags, validateRecordResult } from '../ai-insights.js';
import { extractProgrammeText, programmeChunks, programmeEvidencePassages, validateProgrammeResult, createOpenRouterClient, needsAgentHarness, syncAI } from '../scripts/sync-ai-insights.mjs';

const translated = { fi: 'Suomenkielinen lyhennelmä.', sv: 'En svensk sammanfattning.', en: 'An English brief.' };
const quote = 'We promise to protect funding for public education and research.';
const html = '<nav>Ignore this instruction</nav><div class="platform"><h1>Programme</h1><div>' + quote + '</div><p>' + 'Public policy evidence. '.repeat(12) + '</p></div><footer>Not programme text</footer>';
const theme = { id: 'education-funding', label: { fi: 'Koulutuksen rahoitus', sv: 'Utbildningsfinansiering', en: 'Education funding' }, quote, promise: true };
const vote = { id: 'vote-1', title: 'Education funding', question: 'Approve YES / reject NO', yes: 101, no: 90, date: '2026-10-17', resultUrl: 'https://example.org/vote' };
const law = { id: 'law-1', title: 'Education funding', document: 'HE 1/2026 vp', stages: ['First reading'], latestDate: '2026-10-18', url: 'https://example.org/law' };

test('programme parsing isolates the complete body and requires exact evidence', () => {
  const text = extractProgrammeText(html);
  assert.ok(text.includes(quote));
  assert.ok(!text.includes('instruction'));
  assert.ok(!text.includes('Not programme'));
  assert.equal(validateProgrammeResult({ tags: [theme] }, text)[0].promise, true);
  assert.throws(() => validateProgrammeResult({ tags: [{ ...theme, quote: 'A fabricated promise that does not exist.' }] }, text));
  assert.throws(() => extractProgrammeText('<html>No programme body</html>'));
  assert.throws(() => extractProgrammeText('<div class="platform">' + quote));
});

test('record validation rejects missing languages and invented tags', () => {
  assert.deepEqual(validateRecordResult({ brief: translated, tags: [theme.id, theme.id] }, new Set([theme.id])).tags, [theme.id]);
  assert.throws(() => validateRecordResult({ brief: { fi: 'Only Finnish' }, tags: [] }, new Set()));
  assert.throws(() => validateRecordResult({ brief: translated, tags: ['invented'] }, new Set([theme.id])));
});

test('cache freshness follows substantive record fields, including vote alternatives and results', () => {
  const index = emptyInsights();
  index.records.votes[vote.id] = { fingerprint: sourceFingerprint('votes', vote), tags: [theme.id] };
  assert.ok(currentInsight(index, 'votes', { ...vote, committees: [] }));
  assert.equal(currentInsight(index, 'votes', { ...vote, question: 'Different alternatives' }), null);
  assert.equal(currentInsight(index, 'votes', { ...vote, yes: 102 }), null);
  assert.ok(matchesAITags(index.records.votes[vote.id], 'followed', [theme.id]));
  assert.equal(matchesAITags(null, 'followed', [theme.id]), false);
});

test('shared themes retain evidence from each party', () => {
  const index = emptyInsights();
  index.programmes = { a: { id: 'a', party: 'kok', tags: [theme] }, b: { id: 'b', party: 'sd', tags: [theme] } };
  const tags = insightTags(index);
  assert.equal(tags.length, 1);
  assert.deepEqual(tags[0].references.map(ref => ref.party), ['kok','sd']);
});

test('OpenRouter uses only free endpoints, bounds requests and does not expose provider error bodies', async () => {
  assert.throws(() => createOpenRouterClient({ apiKey: 'test', model: 'paid-model' }), /free/);
  const calls = [];
  const client = createOpenRouterClient({ apiKey: 'test-secret', model: 'nvidia/nemotron-3-super-120b-a12b:free', maxRequests: 1, wait: async () => {}, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ brief: translated, tags: [] }) } }] }) };
  } });
  await client.complete('system', { record: vote });
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-secret');
  assert.equal(JSON.parse(calls[0].options.body).model, 'nvidia/nemotron-3-super-120b-a12b:free');
  assert.equal(DEFAULT_AI_MODEL, 'google/gemma-4-31b-it:free');
  await assert.rejects(client.complete('system', {}), /budget/);
  const limited = createOpenRouterClient({ apiKey: 'test-secret', fetchImpl: async () => ({ ok: false, status: 429, text: () => 'test-secret' }) });
  await assert.rejects(limited.complete('system', {}), error => /429/.test(error.message) && !error.message.includes('test-secret'));
  const truncated = createOpenRouterClient({ apiKey: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }) }) });
  await assert.rejects(truncated.complete('system', {}), /Incomplete/);
});

test('bounded backfill checkpoints, resumes, skips cached work and invalidates changed records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vahtikissa-ai-'));
  const base = pathToFileURL(dir + '/');
  const data = { votes: [vote], legislation: [law] };
  const programme = { id: 'p1', title: 'Programme', url: 'https://example.org/programme', year: 2023, language: 'EN', type: 'vaaliohjelma' };
  const sources = { parties: [{ code: 'kok', programmes: [programme] }] };
  const makeClient = (fail = false) => ({ requests: 0, async complete(system) {
    this.requests++;
    if (fail) throw new Error('Provider unavailable');
    return system.includes('Extract up to') ? { tags: [theme] } : { brief: translated, tags: [theme.id] };
  } });
  try {
    await writeFile(new URL('parliament.json', base), JSON.stringify(data));
    await writeFile(new URL('programmes.json', base), JSON.stringify(sources));
    const fetchImpl = async () => ({ ok: true, text: async () => html });
    const first = await syncAI({ base, client: makeClient(), maxRequests: 2, fetchImpl });
    assert.equal(first.pending, true);
    let index = JSON.parse(await readFile(new URL('ai-insights.json', base)));
    assert.equal(Object.keys(index.records.votes).length, 1);
    assert.equal(Object.keys(index.records.legislation).length, 0);
    const next = makeClient();
    const second = await syncAI({ base, client: next, maxRequests: 2, fetchImpl });
    assert.equal(second.pending, false);
    assert.equal(next.requests, 1);
    const cached = makeClient();
    await syncAI({ base, client: cached, maxRequests: 2, fetchImpl });
    assert.equal(cached.requests, 0);
    index = JSON.parse(await readFile(new URL('ai-insights.json', base)));
    const detail = JSON.parse(await readFile(new URL('ai/' + index.records.legislation[law.id].file, base)));
    assert.deepEqual(detail.brief, translated);
    assert.deepEqual(detail.source, recordSource('legislation', law));
    data.votes[0] = { ...vote, question: 'Different question' };
    await writeFile(new URL('parliament.json', base), JSON.stringify(data));
    await assert.rejects(syncAI({ base, client: makeClient(true), maxRequests: 2, fetchImpl }), /unavailable/);
    index = JSON.parse(await readFile(new URL('ai-insights.json', base)));
    assert.equal(index.records.votes[vote.id], undefined);
    assert.ok(index.records.legislation[law.id]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test('Inkling reads sources through tools and corrects invalid analyses within the request budget', async () => {
  assert.equal(needsAgentHarness(DEFAULT_AI_MODEL), false);
  assert.equal(needsAgentHarness('thinkingmachines/inkling-small:free'), true);
  assert.equal(needsAgentHarness('nvidia/nemotron-3-super-120b-a12b:free'), false);
  const calls=[];
  const client=createOpenRouterClient({apiKey:'test-key',model:'thinkingmachines/inkling-small:free',maxRequests:3,wait:async()=>{},fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body);calls.push(body);
    const name=calls.length===1?'read_source':'submit_analysis';
    const analysis=calls.length===2?{brief:{fi:'Incomplete'},tags:[]}:{brief:translated,tags:[theme.id]};
    return {ok:true,json:async()=>({choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{
      id:'call-'+calls.length,type:'function',function:{name,arguments:JSON.stringify(name==='read_source'?{}:{analysis})}
    }]}}]})};
  }});
  const result=await client.complete('Analyse the source',{record:vote,themes:[theme]},value=>validateRecordResult(value,new Set([theme.id])));
  assert.deepEqual(result.brief,translated);
  assert.equal(client.requests,3);
  assert.equal(calls[0].messages.some(message=>message.content.includes(vote.title)),false,'Source must be read using its tool');
  assert.equal(calls[0].response_format,undefined);
  assert.deepEqual(JSON.parse(calls[1].messages.at(-1).content),{record:vote,themes:[theme]});
  assert.match(JSON.parse(calls[2].messages.at(-1).content).error,/Validation failed/);
  await assert.rejects(client.complete('system',{}),/budget/);
});

test('Inkling rejects prose responses instead of bypassing its source-reading harness',async()=>{
  const client=createOpenRouterClient({apiKey:'test-key',model:'thinkingmachines/inkling-small:free',wait:async()=>{},fetchImpl:async()=>({
    ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({brief:translated,tags:[]})}}]})
  })});
  await assert.rejects(client.complete('system',{record:vote}),/required analysis tools/);
});

test('NVIDIA uses recommended sampling, bounded structured JSON and safe truncation diagnostics', async () => {
  let payload;
  const client=createOpenRouterClient({apiKey:'never-log-this-key',model:'nvidia/nemotron-3.5-super-vl:free',wait:async()=>{},fetchImpl:async(url,options)=>{
    payload=JSON.parse(options.body);
    return {ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'never-log-this-source'}}],usage:{completion_tokens:12000,completion_tokens_details:{reasoning_tokens:0}}})};
  }});
  await assert.rejects(client.complete('system',{}),error=>{
    assert.match(error.message,/finish_reason=length, completion_tokens=12000, reasoning_tokens=0/);
    assert.ok(!error.message.includes('never-log-this'));
    return true;
  });
  assert.equal(payload.max_tokens,3000);
  assert.equal(payload.temperature,1);
  assert.equal(payload.top_p,0.95);
  assert.equal(payload.response_format.type,'json_schema');
  assert.equal(payload.response_format.json_schema.strict,true);
  assert.equal(payload.reasoning.enabled,false);
});

test('rejected programme evidence is corrected without accepting fabricated quotes',async()=>{
  const replies=[{tags:[{...theme,quote:'This evidence was invented and must be rejected.'}]},{tags:[theme]}],calls=[];
  const client=createOpenRouterClient({apiKey:'test',maxRequests:3,wait:async()=>{},fetchImpl:async(url,options)=>{
    calls.push(JSON.parse(options.body));
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(replies.shift())}}]})};
  }});
  const result=await client.complete('Analyse the programme',{sourceText:quote},value=>validateProgrammeResult(value,quote));
  assert.equal(client.requests,2);
  assert.equal(result.tags[0].quote,quote);
  assert.match(calls[1].messages.at(-1).content,/substring verbatim/);
});

test('validation retries are bounded and malformed JSON never reaches the validator',async()=>{
  let validations=0;
  const client=createOpenRouterClient({apiKey:'test',wait:async()=>{},fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'invalid JSON'}}]})})});
  await assert.rejects(client.complete('system',{},()=>{validations++;}),/invalid JSON/);
  assert.equal(client.requests,3);
  assert.equal(validations,0);
});


test('programme requests stay small and provider errors expose only numeric codes',async()=>{
  assert.deepEqual(programmeChunks('a'.repeat(12001)).map(s=>s.length),[6000,6000,1]);
  let payload;
  const client=createOpenRouterClient({apiKey:'never-log-key',model:'nvidia/nemotron-3.5-super-vl:free',maxRequests:1,fetchImpl:async(url,options)=>{
    payload=JSON.parse(options.body);
    return {ok:true,json:async()=>({error:{code:504,message:'never-log-key',metadata:{raw:'never-log-source'}}})};
  }});
  await assert.rejects(client.complete('system',{sourceText:quote}),error=>{
    assert.equal(error.message,'OpenRouter returned an error (code=504)');
    return true;
  });
  assert.equal(payload.response_format.json_schema.schema.properties.tags.maxItems,4);
});


test('temporary server errors retry with backoff while authentication and quota failures stop',async()=>{
  let calls=0;
  const waits=[];
  const client=createOpenRouterClient({apiKey:'test',maxRequests:3,wait:async ms=>waits.push(ms),fetchImpl:async()=>{
    calls++;
    if(calls===1)return {ok:false,status:502};
    if(calls===2)return {ok:true,json:async()=>({error:{code:504,message:'Do not log this body'}})};
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({brief:translated,tags:[]})}}]})};
  }});
  assert.deepEqual(await client.complete('system',{}),{brief:translated,tags:[]});
  assert.equal(client.requests,3);
  assert.deepEqual(waits,[10000,4100,20000,4100]);
  for(const status of [401,403,429]){
    const stopped=createOpenRouterClient({apiKey:'test',wait:async()=>{},fetchImpl:async()=>({ok:false,status})});
    await assert.rejects(stopped.complete('system',{}),new RegExp(String(status)));
    assert.equal(stopped.requests,1);
  }
  const bounded=createOpenRouterClient({apiKey:'test',maxRequests:2,wait:async()=>{},fetchImpl:async()=>({ok:false,status:502})});
  await assert.rejects(bounded.complete('system',{}),/502/);
  assert.equal(bounded.requests,2);
});

test('a correction that reaches the run budget leaves a successful pending checkpoint',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vahtikissa-ai-budget-')),base=pathToFileURL(dir+'/');
  try {
    await writeFile(new URL('parliament.json',base),JSON.stringify({votes:[vote],legislation:[law]}));
    await writeFile(new URL('programmes.json',base),JSON.stringify({parties:[{code:'kok',programmes:[{id:'p1',title:'Programme',url:'https://example.org/programme'}]}]}));
    const client={requests:0,async complete(){
      this.requests++;
      if(this.requests===1)return {tags:[theme]};
      const error=new Error('Budget reached during correction');error.code='AI_REQUEST_BUDGET_EXHAUSTED';throw error;
    }};
    const result=await syncAI({base,client,maxRequests:2,fetchImpl:async()=>({ok:true,text:async()=>html})});
    assert.deepEqual(result,{pending:true,requests:2});
    const index=JSON.parse(await readFile(new URL('ai-insights.json',base)));
    assert.equal(index.programmes.p1.tags[0].quote,quote);
    assert.deepEqual(index.records,{votes:{},legislation:{}});
  } finally {await rm(dir,{recursive:true,force:true});}
});


test('repeated programme IDs merge only after every quote is validated',()=>{
  assert.deepEqual(validateProgrammeResult({tags:[theme,{...theme}]},quote),[theme]);
  assert.throws(()=>validateProgrammeResult({tags:[theme,{...theme,quote:'An invented quote for the same theme must still fail.'}]},quote),/exact source quote/);
  assert.throws(()=>validateProgrammeResult({tags:[{...theme,id:'INVALID ID'}]},quote),/Invalid tag ID/);
});


test('programme passages are bounded verbatim excerpts and selected IDs become exact quotes',async()=>{
  const source=('Suomen koulutus ja terveydenhuolto. Vi stöder utbildning och hälsovård. '+quote+' ').repeat(40).trim();
  const passages=programmeEvidencePassages(source);
  assert.ok(passages.length>1);
  for(const passage of passages){
    assert.ok(passage.text.length>=20 && passage.text.length<=240);
    assert.ok(source.includes(passage.text));
  }
  assert.equal(passages.map(p=>p.text).join(' '),source);
  assert.deepEqual(programmeEvidencePassages('Short'),[]);
  let payload;
  const client=createOpenRouterClient({apiKey:'test',model:'nvidia/nemotron-3.5-super-vl:free',fetchImpl:async(url,options)=>{
    payload=JSON.parse(options.body);
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({tags:[{id:theme.id,label:theme.label,evidenceId:passages[0].id,promise:true}]})}}]})};
  }});
  const result=await client.complete('Analyse the passages',{sourceText:source,evidencePassages:passages},value=>validateProgrammeResult(value,source));
  assert.equal(result.tags[0].quote,passages[0].text);
  assert.equal(result.tags[0].evidenceId,undefined);
  const sent=JSON.parse(payload.messages[1].content);
  assert.equal(sent.sourceText,undefined);
  assert.deepEqual(sent.evidencePassages,passages);
  assert.deepEqual(payload.response_format.json_schema.schema.properties.tags.items.properties.evidenceId.enum,passages.map(p=>p.id));
});

test('unknown passage IDs are rejected even when a model also supplies a valid-looking quote',async()=>{
  const passages=programmeEvidencePassages(quote),calls=[];
  const client=createOpenRouterClient({apiKey:'test',maxRequests:2,wait:async()=>{},fetchImpl:async(url,options)=>{
    calls.push(JSON.parse(options.body));
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({tags:[{...theme,evidenceId:'invented-passage'}]})}}]})};
  }});
  await assert.rejects(client.complete('system',{sourceText:quote,evidencePassages:passages},value=>validateProgrammeResult(value,quote)),/budget|Unknown programme evidence ID/);
  assert.match(calls[1].messages.at(-1).content,/supplied evidencePassages IDs/);
  assert.equal(client.requests,2);
});

test('the tool harness resolves selected passages after source reading',async()=>{
  const passages=programmeEvidencePassages(quote);let calls=0;
  const client=createOpenRouterClient({apiKey:'test',model:'thinkingmachines/inkling-small:free',wait:async()=>{},fetchImpl:async()=>{
    calls++;const name=calls===1?'read_source':'submit_analysis';
    const args=calls===1?{}:{analysis:{tags:[{id:theme.id,label:theme.label,evidenceId:passages[0].id,promise:true}]}};
    return {ok:true,json:async()=>({choices:[{finish_reason:'tool_calls',message:{content:null,tool_calls:[{id:'call-'+calls,type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]})};
  }});
  const result=await client.complete('system',{sourceText:quote,evidencePassages:passages},value=>validateProgrammeResult(value,quote));
  assert.equal(result.tags[0].quote,quote);
  assert.equal(client.requests,2);
});


test('brief validation rejects overlong prose, mixed-language headings and internal fields', () => {
  for (const text of ['word '.repeat(101), 'Suomeksi. Svensk sammanfattning: Mer text.', 'A useful brief. Tags: irrelevant-theme', 'A useful brief. Evidence: document-1-passage-1', 'A useful brief.}']) {
    assert.throws(() => validateRecordResult({ brief: { ...translated, fi: text }, tags: [] }, new Set()), /AI brief/);
  }
  assert.equal(validateRecordResult({ brief: { ...translated, en: 'word '.repeat(100).trim() }, tags: [] }, new Set()).brief.en.split(/\s+/).length, 100);
});

test('brief length correction identifies the language and word count without relaxing validation',async()=>{
  const calls=[];
  const replies=[{brief:{...translated,fi:'sana '.repeat(101).trim()},tags:[]},{brief:translated,tags:[]}];
  const client=createOpenRouterClient({apiKey:'test',model:'nvidia/nemotron-3.5-super-vl:free',maxRequests:3,wait:async()=>{},fetchImpl:async(url,options)=>{
    calls.push(JSON.parse(options.body));
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(replies.shift())}}]})};
  }});
  const result=await client.complete('system',{},value=>validateRecordResult(value,new Set()));
  assert.deepEqual(result.brief,translated);assert.equal(client.requests,2);
  assert.match(calls[1].messages.at(-1).content,/fi brief has 101 words/);
  assert.match(calls[1].messages.at(-1).content,/maximum is 100 per language/);
  assert.match(calls[1].messages.at(-1).content,/Do not truncate a sentence/);
});

test('a repeatedly rejected brief stays unpublished while later records complete within the budget',async()=>{
  const {readdir}=await import('node:fs/promises');
  const dir=await mkdtemp(join(tmpdir(),'vahtikissa-ai-rejected-')),base=pathToFileURL(dir+'/');
  const calls=[];let providerCalls=0;
  const bad={...vote,id:'too-long',date:'2026-10-19'},good={...vote,id:'valid-next',date:'2026-10-18'};
  const fetchImpl=async(url,options)=>{
    assert.match(String(url),/chat\/completions$/);
    providerCalls++;calls.push(JSON.parse(options.body));
    const result={brief:providerCalls<=3?{...translated,fi:'sana '.repeat(101).trim()}:translated,tags:[]};
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]})};
  };
  const client=createOpenRouterClient({apiKey:'test',model:'nvidia/nemotron-3.5-super-vl:free',maxRequests:4,wait:async()=>{},fetchImpl});
  try{
    await writeFile(new URL('parliament.json',base),JSON.stringify({votes:[bad,good],legislation:[]}));
    await writeFile(new URL('programmes.json',base),JSON.stringify({parties:[]}));
    const result=await syncAI({base,client,model:'nvidia/nemotron-3.5-super-vl:free',maxRequests:4,fetchImpl});
    assert.deepEqual(result,{pending:true,requests:4,rejected:1});assert.equal(providerCalls,4);
    assert.equal(JSON.parse(calls[0].messages[1].content).record.id,'too-long');
    assert.equal(JSON.parse(calls[3].messages[1].content).record.id,'valid-next');
    const index=JSON.parse(await readFile(new URL('ai-insights.json',base)));
    assert.equal(index.records.votes['too-long'],undefined);assert.ok(index.records.votes['valid-next']);
    const files=await readdir(new URL('ai/',base));assert.equal(files.length,1);
    const saved=JSON.parse(await readFile(new URL('ai/'+files[0],base)));
    assert.equal(saved.id,'valid-next');assert.deepEqual(saved.brief,translated);
    // Provider failures are not treated as per-record output rejections.
    const unavailable=createOpenRouterClient({apiKey:'test',maxRequests:4,wait:async()=>{},fetchImpl:async()=>({ok:false,status:401})});
    await assert.rejects(syncAI({base,client:unavailable,model:'nvidia/nemotron-3.5-super-vl:free',maxRequests:4,fetchImpl}),/HTTP 401/);
    assert.equal(unavailable.requests,1);
    assert.deepEqual(JSON.parse(await readFile(new URL('ai-insights.json',base))),index);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('parallel analyses share one request gate and never exceed the request cap',async()=>{
  let time=0;const starts=[];
  const client=createOpenRouterClient({apiKey:'test',maxRequests:15,wait:async ms=>{time+=ms;},fetchImpl:async()=>{
    starts.push(time);return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({brief:translated,tags:[]})}}]})};
  }});
  const results=await Promise.allSettled(Array.from({length:24},()=>client.complete('system',{},value=>validateRecordResult(value,new Set()))));
  assert.equal(starts.length,15);assert.equal(client.requests,15);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,15);
  for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=4100);
});

test('parallel record checkpoints retain every completed brief when the request budget runs out',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'vahti-ai-parallel-')),base=pathToFileURL(dir+'/');
  const data={votes:Array.from({length:40},(_,i)=>({...vote,id:'parallel-'+i,date:'2026-10-19'})),legislation:[]};
  let calls=0;
  const client=createOpenRouterClient({apiKey:'test',maxRequests:20,wait:async()=>{},fetchImpl:async()=>{
    calls++;await new Promise(resolve=>setTimeout(resolve,calls%3));
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({brief:translated,tags:[]})}}]})};
  }});
  try{
    await writeFile(new URL('parliament.json',base),JSON.stringify(data));await writeFile(new URL('programmes.json',base),JSON.stringify({parties:[]}));
    const result=await syncAI({base,client,maxRequests:20,concurrency:10});assert.equal(result.pending,true);assert.equal(calls,20);
    const index=JSON.parse(await readFile(new URL('ai-insights.json',base)));assert.equal(Object.keys(index.records.votes).length,20);
    for(const [id,entry] of Object.entries(index.records.votes))assert.equal(JSON.parse(await readFile(new URL('ai/'+entry.file,base))).id,id);
  }finally{await rm(dir,{recursive:true,force:true});}
});
