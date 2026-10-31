import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNetworkLoader,commonBallotEvidence,relationshipExport} from '../network-data.js';
import {packPairs,unpackPairs,decodeNetworkData} from '../network-format.js';

test('manifest pins evidence, rejects undeclared paths and mismatching snapshot',async()=>{
  const id='a'.repeat(24), body=JSON.stringify({manifestId:id,data:[1]});
  const source={id,files:{'graph.json':{sha256:createHash('sha256').update(body).digest('hex')}}};
  const requests=[];
  const loader=createNetworkLoader(async url=>{requests.push(url);return {ok:true,json:async()=>source,text:async()=>body};});
  assert.deepEqual(await loader.load('graph.json'),[1]);
  await loader.load('graph.json');
  assert.equal(requests.length,2);
  await assert.rejects(loader.load('../raw.json'),/not declared/);
  const bad=createNetworkLoader(async url=>({ok:true,json:async()=>source,text:async()=>JSON.stringify({manifestId:'b'.repeat(24),data:[]})}));
  await assert.rejects(bad.load('graph.json'),/manifest|snapshots/);
});
test('pair evidence reproduces eligibility and event-time party with period/topic scope',()=>{
  const left=[['v1','1','old','yes'],['v2','1','new','abstain'],['v3','1','new','absent']];
  const right=[['v1','2','p','yes'],['v2','2','p','no'],['v3','2','p','absent']];
  const votes=['v1','v2','v3'].map((id,i)=>({id,date:`2026-01-0${i+1}`,topics:['tax'],file:`vote-${i}.json`}));
  const rows=commonBallotEvidence(left,right,votes,{topic:'tax'});
  assert.deepEqual(rows.map(r=>[r.partyA,r.agreement]),[['old',true],['new',false]]);
  assert.equal(commonBallotEvidence(left,right,votes,{from:'2026-01-02'}).length,1);
  assert.equal(commonBallotEvidence(left,right,votes,{topic:'health'}).length,0);
});
test('filtered exports include method, settings and manifest even for unavailable observations',()=>{
  const rows=relationshipExport([],{manifestId:'x',feature:'f',filters:{mp:'1'},method:{version:1}});
  assert.equal(rows[0].manifestId,'x');assert.match(rows[0].status,/No supported/);assert.equal(JSON.parse(rows[0].filters).mp,'1');
});
test('compact pair transfer retains every numerator and unrounded rate symmetrically',()=>{
  const stat=(common,agree)=>({common,agree,agreement:common?agree/common:null});
  const pair={a:'1',b:'2',...stat(41,23),yesNo:stat(37,21),contested:stat(0,0),matterWeighted:stat(7,3.141592653589793),sessionWeighted:stat(4,2.4343434343)};
  const [decoded]=unpackPairs(packPairs([pair],'2'),'2');
  assert.equal(decoded.a,'2');assert.equal(decoded.b,'1');
  for(const key of ['common','agree','agreement','yesNo','contested','matterWeighted','sessionWeighted'])assert.deepEqual(decoded[key],pair[key]);
});
test('compact lobbying transfer reconstructs source declaration, target status and distinct IDs',()=>{
  const result=decodeNetworkData({relationEncoding:'organisation-1',organisation:{id:'o',companyId:'123',label:'Actor'},targets:[{id:'t',label:'Recipient',kind:'mp'}],declarations:[{id:'d',period:{start:'2025-01-01',end:'2025-06-30'},diaryNumber:'D',sourceUrl:'https://example.test'}],relationships:[['r','d','topic','t','period','candidate-unreviewed',['source']]]});
  assert.equal(result.relationships[0].targetLabel,'Recipient');assert.equal(result.relationships[0].identityStatus,'candidate-unreviewed');assert.deepEqual(result.relationships[0].sourceRecordIds,['source']);assert.equal('mpId' in result.relationships[0],false);
});
test('browser calculations verify the frozen module bytes and reject changed code',async()=>{
  const id='d'.repeat(24),code='self.onmessage = () => {};',manifest={id,files:{},code:{'network-worker.js':{sha256:createHash('sha256').update(code).digest('hex')}}};
  let requests=0;const loader=createNetworkLoader(async url=>{requests++;return {ok:true,json:async()=>manifest,text:async()=>code};});
  assert.equal(await loader.verifyCode(),id);await loader.verifyCode();assert.equal(requests,2);
  const bad=createNetworkLoader(async()=>({ok:true,json:async()=>manifest,text:async()=>'changed'}));await assert.rejects(bad.verifyCode(),/Calculation code/);
});
