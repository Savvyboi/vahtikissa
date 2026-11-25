import test from 'node:test';
import assert from 'node:assert/strict';
import {voteSourcesPublishedByVote} from '../ai-insights.js';
import {selectDocumentExcerpt,selectOriginalDocument,documentPassages,validateDocumentEvidence,createDocumentLoader} from '../scripts/ai-document-sources.mjs';
test('document matching rejects fuzzy same-number results and requires the original Finnish document',()=>{
 const wanted={eduskuntatunnus:'HE 69/2026 vp',kielikoodi:'fi',fullText:'Correct proposal'};
 assert.equal(selectOriginalDocument({asiakirjat:[{...wanted,eduskuntatunnus:'PTK 69/2026 vp'},{...wanted,kielikoodi:'sv'},wanted]},wanted.eduskuntatunnus),wanted);
 assert.equal(selectOriginalDocument({asiakirjat:[{...wanted,eduskuntatunnus:'PTK 69/2026 vp'}]},wanted.eduskuntatunnus),undefined);
});
test('proposal main-content excerpts exclude navigation and later background sections',()=>{
 const main='Esityksen mukaan tuen saajan olisi asuttava Suomessa vähintään kolme vuotta. Tuki maksettaisiin vain lasta pääasiallisesti hoitavalle vanhemmalle. Poikkeus koskee aiemmin muuttaneita.';
 assert.equal(selectDocumentExcerpt('Header\nESITYKSEN PÄÄASIALLINEN SISÄLTÖ\n'+main+'\nPERUSTELUT\nLong background'),main);
 const docs=[{document:'HE 69/2026 vp',text:main,url:'https://www.eduskunta.fi/example'}];const passages=documentPassages(docs);
 assert.ok(passages.length);for(const p of passages)assert.ok(main.includes(p.quote));
 assert.deepEqual(validateDocumentEvidence({evidenceIds:[passages[0].id]},passages),[passages[0]]);
 assert.throws(()=>validateDocumentEvidence({evidenceIds:['invented']},passages),/Unknown/);
 assert.throws(()=>validateDocumentEvidence({},passages),/evidence/);
});
test('missing original documents fall back explicitly without substituting a fuzzy result',async()=>{
 let requests=0;const load=createDocumentLoader({fetchImpl:async()=>{requests++;return {ok:true,json:async()=>({asiakirjat:[{eduskuntatunnus:'PTK 69/2026 vp',kielikoodi:'fi',fullText:'Unrelated material'}]})};}});
 assert.deepEqual(await load('HE 69/2026 vp'),[]);assert.deepEqual(await load('HE 69/2026 vp'),[]);assert.equal(requests,1);
});

test('an outage retries and rejects separately from a missing document',async()=>{
 let attempts=0;
 const load=createDocumentLoader({fetchImpl:async()=>{attempts++;return new Response(null,{status:503});}});
 await assert.rejects(load('HE 69/2026 vp'),/Parliament source lookup failed.*HTTP 503/);
 assert.equal(attempts,3);
 const absent=createDocumentLoader({fetchImpl:async()=>new Response(null,{status:404})});
 assert.deepEqual(await absent('HE 69/2026 vp'),[]);
});

test('the original document loader uses the newest exact version available at the vote',async()=>{
 const date='2026-10-16T13:00:00Z';
 const id='HE 69/2026 vp';
 const earlier={eduskuntatunnus:id,edktunnus:'EDK-2026-AK-20573',kielikoodi:'fi',
  fullText:'Document evidence about a change in the benefit rules. '.repeat(4),
  viimeisinJulkaisuajankohta:'2026-10-15T15:00:00Z'};
 const later={...earlier,viimeisinJulkaisuajankohta:'2026-10-17T15:00:00Z'};
 const load=createDocumentLoader({fetchImpl:async()=>Response.json({asiakirjat:[later,earlier]})});
 const [original]=await load(id,{publishedBy:date});
 assert.equal(original.publishedAt,earlier.viimeisinJulkaisuajankohta);
 assert.equal((await load(id))[0].publishedAt,later.viimeisinJulkaisuajankohta);
 assert.deepEqual(await load(id,{publishedBy:'2026-10-14T15:00:00Z'}),[]);
 assert.ok(voteSourcesPublishedByVote({briefBasis:'document-excerpt',source:{date},documents:[original]}));
 assert.equal(voteSourcesPublishedByVote({briefBasis:'document-excerpt',source:{date},documents:[{publishedAt:later.viimeisinJulkaisuajankohta}]}),false);
});

test('source-backed brief generation stores verified passages and upgrades records without reanalysing programmes',async()=>{
 const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');
 const {syncAI,RECORD_PROMPT_VERSION}=await import('../scripts/sync-ai-insights.mjs');
 const dir=await mkdtemp(join(tmpdir(),'vahti-document-test-')),base=pathToFileURL(dir+'/');
 const text='Esityksessä ehdotetaan vähintään kolmen vuoden asumisaikaa kotihoidon tuen saamiseksi. Tuki maksettaisiin vain lasta pääasiallisesti hoitavalle vanhemmalle tai huoltajalle.';
 const quote='We promise to support public services and education.';
 const tag={id:'education',label:{fi:'Koulutus',sv:'Utbildning',en:'Education'},quote,promise:true};
 const client={requests:0,async complete(system,input,validate){this.requests++;const value=system.includes('Extract up to')?{tags:[tag]}:{brief:{fi:'Tuen saamiseksi ehdotetaan kolmen vuoden asumisaikaa.',sv:'Tre års bosättning föreslås som villkor för stödet.',en:'Three years of residence is proposed as a condition for the benefit.'},tags:[],evidenceIds:[input.documentEvidence[0].id]};validate(value);return value;}};
 try{
  await writeFile(new URL('parliament.json',base),JSON.stringify({votes:[{id:'v1',document:'HE 69/2026 vp',title:'Support',date:'2026-10-16'}],legislation:[]}));
  await writeFile(new URL('programmes.json',base),JSON.stringify({parties:[{code:'kok',programmes:[{id:'p1',url:'https://example.org/programme'}]}]}));
  const fetchImpl=async url=>url.includes('example.org')?{ok:true,text:async()=>'<div class="platform">'+quote+' '+'Source programme text. '.repeat(15)+'</div>'}:{ok:true,json:async()=>({asiakirjat:[{eduskuntatunnus:'HE 69/2026 vp',edktunnus:'EDK-2026-AK-20573',kielikoodi:'fi',nimeketeksti:'Support',fullText:text,viimeisinJulkaisuajankohta:'2026-10-15T09:00:00Z'}]})};
  await syncAI({base,client,fetchImpl,maxRequests:2});const index=JSON.parse(await readFile(new URL('ai-insights.json',base)));
  assert.equal(index.programmes.p1.promptVersion,4);assert.equal(index.records.votes.v1.promptVersion,RECORD_PROMPT_VERSION);
  const brief=JSON.parse(await readFile(new URL('ai/'+index.records.votes.v1.file,base)));assert.equal(brief.briefBasis,'document-excerpt');assert.ok(text.includes(brief.evidence[0].quote));assert.match(brief.documents[0].url,/EDK-2026-AK-20573$/);
  index.records.votes.v1.promptVersion=5;
  await writeFile(new URL('ai-insights.json',base),JSON.stringify(index));
  client.requests=0;
  const reused=await syncAI({base,client,fetchImpl,maxRequests:2});
  assert.equal(client.requests,0,'The longer brief format does not trigger regeneration of existing source-backed briefs');
  assert.equal(reused.pending,false);
  delete index.records.votes.v1.voteSourcesVerified;
  brief.documents[0].publishedAt='2026-10-17T09:00:00Z';
  await writeFile(new URL('ai-insights.json',base),JSON.stringify(index));
  await writeFile(new URL('ai/'+index.records.votes.v1.file,base),JSON.stringify(brief));
  await syncAI({base,client,fetchImpl,maxRequests:2});
  assert.equal(client.requests,1,'A cached brief with a post-vote source is regenerated');
  const replacement=JSON.parse(await readFile(new URL('ai-insights.json',base))).records.votes.v1;
  const repaired=JSON.parse(await readFile(new URL('ai/'+replacement.file,base)));
  assert.ok(voteSourcesPublishedByVote(repaired));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a metadata-only recheck does not change the published brief index',async t=>{
 const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {pathToFileURL}=await import('node:url');
 const {syncAI}=await import('../scripts/sync-ai-insights.mjs');
 const dir=await mkdtemp(join(tmpdir(),'vahti-recheck-test-')),base=pathToFileURL(dir+'/');
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const id='HE 69/2026 vp';
 await writeFile(new URL('parliament.json',base),JSON.stringify({votes:[],legislation:[{id}]}));
 await writeFile(new URL('programmes.json',base),JSON.stringify({parties:[]}));
 const client={requests:0,async complete(){this.requests++;return {brief:{fi:'Esitys.',sv:'Förslag.',en:'Proposal.'},tags:[]};}};
 const fetchImpl=async()=>new Response(null,{status:404});
 const indexFile=new URL('ai-insights.json',base);
 await syncAI({base,client,fetchImpl});
 const index=JSON.parse(await readFile(indexFile,'utf8'));
 index.records.legislation[id].sourceCheckedAt='2026-01-01T00:00:00Z';
 const before=JSON.stringify(index);
 await writeFile(indexFile,before);
 await syncAI({base,client,fetchImpl});
 assert.equal(client.requests,1);
 assert.equal(await readFile(indexFile,'utf8'),before);
 const rechecks=JSON.parse(await readFile(new URL('ai-source-checks.json',base),'utf8'));
 assert.ok(rechecks.legislation[id].checkedAt);
});

test('vote sources exclude committee reports published after the vote',async()=>{
 const {selectVoteReport}=await import('../scripts/ai-document-sources.mjs');
 const before={eduskuntatunnus:'StVM 14/2026 vp',asiakirjatyyppikoodi:'StVM',laadintapvm:'2026-10-08',viimeisinJulkaisuajankohta:'2026-10-15T13:00:00Z'};
 const after={...before,eduskuntatunnus:'StVM 15/2026 vp',laadintapvm:'2026-10-17',viimeisinJulkaisuajankohta:'2026-10-17T13:00:00Z'};
 assert.deepEqual(selectVoteReport({keskeisetAsiakirjat:{fi:[after,before]}},'2026-10-16T13:00:00Z'),before);
});

test('bounded evidence passages preserve decimal amounts and exact original substrings',()=>{
 const text=('The proposal adds EUR 1.7 million and changes section 15. '+'A long supporting sentence. '.repeat(30)).repeat(2);
 const passages=documentPassages([{document:'HE 1/2026 vp',url:'https://example.org',text}]);
 assert.ok(passages.some(p=>p.quote.includes('EUR 1.7 million')));assert.ok(passages.every(p=>p.quote.length<=650 && text.includes(p.quote)));
});
