import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRecordResult,insightTags} from '../ai-insights.js';
const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const hash=text=>createHash('sha256').update(text).digest('hex');
test('published source-based briefs stay concise and retain exact source evidence',async()=>{
 const index=await json('data/ai-insights.json');const allowed=new Set(insightTags(index).map(t=>t.id));
 const sources=new Map();let checked=0;
 for(const kind of ['votes','legislation'])for(const [id,entry] of Object.entries(index.records[kind])){
  if(entry.promptVersion<5)continue;
  const file=await json('data/ai/'+entry.file);assert.equal(file.id,id);assert.equal(file.kind,kind);
  validateRecordResult(file,allowed);assert.deepEqual(file.tags,entry.tags);
  for(const text of Object.values(file.brief))assert.ok(!text.includes('undefined'));
  if(file.briefBasis==='document-excerpt'){
   assert.ok(file.evidence.length>0);
   for(const document of file.documents){
    if(!sources.has(document.document))sources.set(document.document,await json('data/ai-sources/'+hash(document.document)+'.json'));
    assert.equal(hash(sources.get(document.document).text),document.sourceHash);
   }
   for(const evidence of file.evidence)assert.ok(sources.get(evidence.document)?.text.includes(evidence.quote),id+' evidence must be verbatim');
  }else assert.equal(file.evidence.length,0);
  if(file.reviewedAt){assert.ok(Number.isFinite(Date.parse(file.reviewedAt)));assert.match(file.reviewMethod,/Editorial review/);}
  checked++;
 }
 assert.ok(checked>0);
});
