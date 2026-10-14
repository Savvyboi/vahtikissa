import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetLevel, budgetChange, budgetTotals, budgetTreemap } from '../budget-utils.js';
import { fetchParliamentMembers } from '../scripts/parliament-members.mjs';
import { parseProgrammes } from '../scripts/sync-programmes.mjs';

test('budget borrowing is separated from revenue when calculating the deficit',()=>{
  assert.deepEqual(budgetTotals({income:[{code:'11',budget:70},{code:'15',budget:20}],expense:[{budget:90}]}),{income:90,expense:90,revenue:70,borrowing:20,balance:-20});
});
test('budget drill-down resolves every level and rejects paths on the wrong side',()=>{
  const moment={code:'290101',budget:5}, chapter={code:'2901',children:[moment]}, main={code:'29',children:[chapter]}, year={expense:[main],income:[]};
  assert.equal(budgetLevel(year,'expense',['29','2901','290101']).node,moment);
  assert.deepEqual(budgetLevel(year,'expense',['29','2901','290101']).items,[]);
  assert.equal(budgetLevel(year,'income',['29']).valid,false);
  assert.equal(budgetLevel(year,'expense',['29','missing']).valid,false);
});
test('treemap rectangles preserve areas and remain within the chart',()=>{
  const items=Array.from({length:22},(_,i)=>({code:String(i),budget:i+1}));
  const total=items.reduce((n,x)=>n+x.budget,0),rectangles=budgetTreemap(items);
  assert.equal(rectangles.length,items.length);
  for(const r of rectangles){assert.ok(Math.abs(r.width*r.height/6500-r.value/total)<1e-9);assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=100+1e-9&&r.y+r.height<=65+1e-9);}
  for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){let a=rectangles[i],b=rectangles[j];assert.ok(a.x+a.width<=b.x+1e-9||b.x+b.width<=a.x+1e-9||a.y+a.height<=b.y+1e-9||b.y+b.height<=a.y+1e-9);}
  assert.deepEqual(budgetTreemap([{budget:0},{budget:-1}]),[]);
  assert.equal(budgetChange(110,100),10);assert.equal(budgetChange(10,0),null);
});
test('member imports use the directory and individual records without the removed bulk route',async()=>{
  const requests=[];
  const records={active:{henkilonro:'active'},tracked:{henkilonro:'tracked'}};
  const request=async path=>{
    requests.push(path);
    if(path==='/reference-data/kansanedustajat')return [{tunnus:'active',aktiivinen:true},{tunnus:'old',aktiivinen:false}];
    if(path.startsWith('/kansanedustajat/')&&records[path.split('/').at(-1)])return records[path.split('/').at(-1)];
    throw new Error('404 '+path);
  };
  const result=await fetchParliamentMembers(request,{memberIds:['tracked','active','tracked']});
  assert.deepEqual(result.members,[records.active,records.tracked]);
  assert.deepEqual(result.activeIds,['active']);
  assert.deepEqual(requests,['/reference-data/kansanedustajat','/kansanedustajat/active','/kansanedustajat/tracked']);
  requests.length=0;
  const active=await fetchParliamentMembers(request,{activeOnly:true,memberIds:['tracked']});
  assert.deepEqual(active.members,[records.active]);
  assert.deepEqual(requests,['/reference-data/kansanedustajat','/kansanedustajat/active']);
});
test('incomplete individual member responses fail rather than publishing missing disclosures',async()=>{
  for(const record of [{},{henkilonro:'456'}]){
    await assert.rejects(fetchParliamentMembers(async path=>path==='/reference-data/kansanedustajat'?[{tunnus:'123',aktiivinen:true}]:record),/Incomplete Parliament member record: 123/);
  }
});
test('invalid directories and failed individual requests reject the member import',async()=>{
  await assert.rejects(fetchParliamentMembers(async()=>({})),/Invalid Parliament member response/);
  await assert.rejects(fetchParliamentMembers(async()=>[{tunnus:'old',aktiivinen:false}]),/no active members/);
  await assert.rejects(fetchParliamentMembers(async path=>{
    if(path==='/reference-data/kansanedustajat')return [{tunnus:'123',aktiivinen:true}];
    throw new Error('503 Parliament unavailable');
  }),/503 Parliament unavailable/);
});
test('individual member requests stay bounded and results retain directory order',async()=>{
  const reference=Array.from({length:15},(_,id)=>({tunnus:String(id),aktiivinen:true}));
  let inFlight=0,peak=0;
  const result=await fetchParliamentMembers(async path=>{
    if(path==='/reference-data/kansanedustajat')return reference;
    inFlight++;peak=Math.max(peak,inFlight);
    const id=path.split('/').at(-1);
    await new Promise(resolve=>setTimeout(resolve,15-Number(id)));
    inFlight--;
    return {henkilonro:id};
  });
  assert.equal(peak,6);
  assert.equal(inFlight,0);
  assert.deepEqual(result.members.map(member=>member.henkilonro),reference.map(member=>member.tunnus));
});
test('Pohtiva programmes retain metadata and exclude parties outside Parliament',()=>{
  const table=party=>`<h5>${party}</h5><table><tr><td><a href="https://www.fsd.tuni.fi/pohtiva/ohjelmalistat/KOK/1473">Testi &amp; ohjelma</a></td><td>${party}</td><td>2023</td><td>vaaliohjelma</td><td>FI</td></tr></table>`;
  const result=parseProgrammes(table('Kansallinen Kokoomus')+table('Avoin Puolue'),new Map([['kok',48]]));
  assert.equal(result.length,1);assert.equal(result[0].seats,48);assert.equal(result[0].programmes[0].title,'Testi & ohjelma');assert.equal(result[0].programmes[0].language,'FI');
  assert.throws(()=>parseProgrammes('<html>Unavailable</html>',new Map([['kok',48]])),/Missing/);
  assert.throws(()=>parseProgrammes(table('Kansallinen Kokoomus').replace('https://www.fsd.tuni.fi','https://example.com'),new Map([['kok',48]])),/Unexpected/);
});
