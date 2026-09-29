import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionState, matchesSelection, applyCollection, facetOptions } from '../collection-tools.js';

test('multiple inclusions are ORed, exclusions take precedence, and empty includes mean all', () => {
  assert.equal(matchesSelection(['kok','sd'],{include:['kok','vihr']}),true);
  assert.equal(matchesSelection(['kok','sd'],{include:['kok'],exclude:['sd']}),false);
  assert.equal(matchesSelection('sd',{exclude:['kok']}),true);
  assert.equal(matchesSelection(undefined,{include:['kok']}),false);
});

test('independent facets, bilingual search, date bounds and numeric bounds combine', () => {
  const rows=[
    {name:'Terveys',sv:'Hälsa',party:'kok',topics:['health','economy'],date:'2026-09-01',value:30},
    {name:'Koulutus',sv:'Skola',party:'sd',topics:['education'],date:'2026-09-02',value:10},
    {name:'Terveys',sv:'Hälsa',party:'sd',topics:['health'],date:'2026-08-01',value:50}
  ];
  const config={search:item=>[item.name,item.sv],date:item=>item.date,number:{value:item=>item.value},facets:[{key:'party',value:item=>item.party},{key:'topic',value:item=>item.topics}],sorts:[{key:'value',value:item=>item.value}]};
  const state={...collectionState('value'),query:'hälsa',from:'2026-09-01',to:'2026-09-02',min:'20',max:'30',facets:{party:{include:['kok','sd']},topic:{include:['health'],exclude:['education']}}};
  assert.deepEqual(applyCollection(rows,state,config,'sv'),[rows[0]]);
  assert.deepEqual(applyCollection(rows,{...state,min:'31'},config),[]);
  assert.deepEqual(applyCollection(rows,{...state,from:'2026-10-01'},config),[]);
});

test('sorting works in both directions without mutating input and leaves missing values last', () => {
  const rows=[{value:2},{value:null},{value:12},{value:2}];
  const original=[...rows],config={sorts:[{key:'value',value:item=>item.value}]};
  assert.deepEqual(applyCollection(rows,collectionState('value'),config),[rows[0],rows[3],rows[2],rows[1]]);
  assert.deepEqual(applyCollection(rows,collectionState('value','desc'),config),[rows[2],rows[0],rows[3],rows[1]]);
  assert.deepEqual(rows,original);
});

test('facet options preserve identifiers, remove duplicates and sort localized labels', () => {
  assert.deepEqual(facetOptions([{p:['sd','kok']},{p:['kok']}],item=>item.p,key=>({sd:'SDP',kok:'Kokoomus'}[key])),[{key:'kok',label:'Kokoomus'},{key:'sd',label:'SDP'}]);
});
