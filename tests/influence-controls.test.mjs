import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionState } from '../collection-tools.js';
import { influenceSelection, influenceDate, influenceConfig, selectInfluence, readInfluenceURL, influenceHash, memberNameLink } from '../influence-controls.js';

const gifts = [
  { id:'new', mpName:'Åsa Ääkkönen', year:2025, reported:'02.01.2026', used:'01.12.2025', amount:125.5, party:'r' },
  { id:'large', mpName:'Toinen Edustaja', year:2026, reported:'01.02.2026', used:'01.01.2026', amount:800, party:'kok' },
  { id:'old', mpName:'Åsa Ääkkönen', year:2025, reported:'31.12.2025', used:'02.01.2026', amount:2000, party:'r' },
  { id:'unknown', mpName:'Toinen Edustaja', year:2026, reported:'01.03.2026', amount:null, party:'kok' }
];
test('gift periods and newest ordering use declaration dates, independently of receipt/use and source year',()=>{
  const state={...influenceSelection(),period:'2026'},extra=collectionState('date','desc');
  assert.equal(influenceDate(gifts[0],'gifts'),'2026-01-02');
  assert.deepEqual(selectInfluence(gifts,state,extra,influenceConfig('gifts','fi'),'gifts','fi').map(item=>item.id),['unknown','large','new']);
});
test('largest and smallest gifts respect a minimum value, retain cents, and put unknown values last',()=>{
  const state={...influenceSelection(),period:'2026'},extra={...collectionState('amount','desc'),min:'125.5'};
  const selected=()=>selectInfluence(gifts,state,extra,influenceConfig('gifts','fi'),'gifts','fi').map(item=>item.id);
  assert.deepEqual(selected(),['large','new']);
  extra.direction='asc';assert.deepEqual(selected(),['new','large']);
  extra.min='';assert.deepEqual(selected(),['new','large','unknown']);
  extra.direction='desc';assert.deepEqual(selected(),['large','new','unknown']);
});
test('lobbying sorts by the reporting period rather than notification submission date and filters overlapping years',()=>{
  const items=[
    {id:'older',period:{start:'2025-07-01',end:'2025-12-31'},reported:'2026-04-01',targetIds:[1,2]},
    {id:'newer',period:{start:'2026-01-01',end:'2026-06-30'},reported:'2026-03-01',targetIds:[1]},
    {id:'overlap',period:{start:'2025-12-01',end:'2026-01-31'},reported:'2026-02-01',targetIds:[1,2,3]}
  ];
  const config=influenceConfig('lobbying','en'),extra=collectionState('date','desc');
  assert.deepEqual(selectInfluence(items,{...influenceSelection(),period:'2026'},extra,config,'lobbying','en').map(i=>i.id),['newer','overlap']);
  assert.equal(config.sorts.find(sort=>sort.key==='targets').label,'Reported recipients');
});
test('the parliamentary-term shortcut excludes older dated gifts without inventing exact dates for annual interests',()=>{
  const state={...influenceSelection(),period:'term'},extra=collectionState('date','desc');
  assert.deepEqual(selectInfluence([{id:1,reported:'04.04.2023'},{id:2,reported:'05.04.2023'}],state,extra,influenceConfig('gifts','fi'),'gifts','fi').map(i=>i.id),[2]);
  assert.deepEqual(selectInfluence([{year:2022},{year:2023}],state,extra,influenceConfig('interests','fi'),'interests','fi').map(i=>i.year),[2023]);
});
test('shared links restore every common and advanced filter and yield the same ordered results in either mode',()=>{
  const state={...influenceSelection(),period:'2026',query:'Ääkkönen',excludedCategories:new Set(['Metsätalous & luonto'])};
  const extra={...collectionState('amount','desc'),min:'100',max:'1000',from:'2026-01-01',to:'2026-12-31',facets:{party:{include:['r'],exclude:['kok']}}};
  const hash=influenceHash('#/influence?old=unused','gifts',state,extra),restored=readInfluenceURL(hash);
  assert.equal(restored.tab,'gifts');assert.equal(restored.state.query,state.query);assert.equal(restored.extra.min,'100');assert.deepEqual(restored.extra.facets,extra.facets);
  assert.deepEqual(restored.state.excludedCategories,['Metsätalous & luonto']);
  const select=(s,x)=>selectInfluence(gifts,s,x,influenceConfig('gifts','fi'),'gifts','fi').map(i=>i.id);
  assert.deepEqual(select(restored.state,restored.extra),select(state,extra));assert.deepEqual(select(state,extra),['new']);
  assert.equal(influenceHash(hash,restored.tab,restored.state,restored.extra),hash);
});
test('member routes default to their interests and malformed optional URL refinements remain recoverable',()=>{
  const result=readInfluenceURL('#/influence/1?tab=bad&facets=%7B&order=invalid:bad&min=NaN&period=bad','Åsa Ääkkönen');
  assert.equal(result.tab,'interests');assert.equal(result.state.mp,'Åsa Ääkkönen');assert.equal(result.state.period,'all');assert.equal(result.extra.sort,'date');assert.equal(result.extra.min,'');
  const hash=influenceHash('#/influence/1','gifts',influenceSelection(),collectionState('date','desc'));
  assert.equal(readInfluenceURL(hash,'Åsa Ääkkönen').state.mp,'all','Explicitly clearing a member remains cleared when shared');
});
test('MP names link by official ID or exact name in either source order; ambiguous names remain text',()=>{
  const members=[{id:'1',firstName:'Åsa',lastName:'Ääkkönen'}];
  assert.match(memberNameLink({},members,'Ääkkönen Åsa'),/href="#\/members\/1"/);
  assert.match(memberNameLink({mpId:'2',mpName:'<Test>'},members),/&lt;Test&gt;/);
  assert.equal(memberNameLink({},[...members,{...members[0],id:'3'}],'Åsa Ääkkönen'),'Åsa Ääkkönen');
});
