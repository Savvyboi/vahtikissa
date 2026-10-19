import test from 'node:test';
import assert from 'node:assert/strict';
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

test('source-backed brief generation stores verified passages and upgrades records without reanalysing programmes',async()=>{
 const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');
 const {syncAI}=await import('../scripts/sync-ai-insights.mjs');
 const dir=await mkdtemp(join(tmpdir(),'vahti-document-test-')),base=pathToFileURL(dir+'/');
 const text='Esityksessä ehdotetaan vähintään kolmen vuoden asumisaikaa kotihoidon tuen saamiseksi. Tuki maksettaisiin vain lasta pääasiallisesti hoitavalle vanhemmalle tai huoltajalle.';
 const quote='We promise to support public services and education.';
 const tag={id:'education',label:{fi:'Koulutus',sv:'Utbildning',en:'Education'},quote,promise:true};
 const client={requests:0,async complete(system,input,validate){this.requests++;const value=system.includes('Extract up to')?{tags:[tag]}:{brief:{fi:'Tuen saamiseksi ehdotetaan kolmen vuoden asumisaikaa.',sv:'Tre års bosättning föreslås som villkor för stödet.',en:'Three years of residence is proposed as a condition for the benefit.'},tags:[],evidenceIds:[input.documentEvidence[0].id]};validate(value);return value;}};
 try{
  await writeFile(new URL('parliament.json',base),JSON.stringify({votes:[{id:'v1',document:'HE 69/2026 vp',title:'Support',date:'2026-10-16'}],legislation:[]}));
  await writeFile(new URL('programmes.json',base),JSON.stringify({parties:[{code:'kok',programmes:[{id:'p1',url:'https://example.org/programme'}]}]}));
  const fetchImpl=async url=>url.includes('example.org')?{ok:true,text:async()=>'<div class="platform">'+quote+' '+'Source programme text. '.repeat(15)+'</div>'}:{ok:true,json:async()=>({asiakirjat:[{eduskuntatunnus:'HE 69/2026 vp',edktunnus:'EDK-2026-AK-20573',kielikoodi:'fi',nimeketeksti:'Support',fullText:text}]})};
  await syncAI({base,client,fetchImpl,maxRequests:2});const index=JSON.parse(await readFile(new URL('ai-insights.json',base)));
  assert.equal(index.programmes.p1.promptVersion,4);assert.equal(index.records.votes.v1.promptVersion,5);
  const brief=JSON.parse(await readFile(new URL('ai/'+index.records.votes.v1.file,base)));assert.equal(brief.briefBasis,'document-excerpt');assert.ok(text.includes(brief.evidence[0].quote));assert.match(brief.documents[0].url,/EDK-2026-AK-20573$/);
  client.requests=0;await syncAI({base,client,fetchImpl,maxRequests:2});assert.equal(client.requests,0);
 }finally{await rm(dir,{recursive:true,force:true});}
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
