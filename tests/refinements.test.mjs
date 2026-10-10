import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWordClouds,cloudWordVariants} from '../speech-research.js';
import {directoryContacts} from '../scripts/sync-member-contacts.mjs';
import {normalizeMemberProfile} from '../scripts/member-profiles.mjs';
import {budgetEntries,searchBudgetEntries} from '../budget-utils.js';

test('clouds keep hyphenated policy words, exclude dangling prefixes and recorded MP surnames',()=>{
  const c=buildWordClouds([{mpId:'1',text:'osa-aikatyötä ulko- ja turvallisuuspolitiikka Orpo Orpon Laiholle Nurmisen kiitoksia tosiaan ilmasto'}],60,['1'],['Orpo','Laiho','Nurminen']);
  assert.deepEqual(c.members['1'].terms.map(t=>t.word).sort(),['ilmasto','osa-aikatyötä','turvallisuuspolitiikka']);
});
test('cloud selection removes transparent variants without merging occurrence counts',()=>{
  const cloud=buildWordClouds([{mpId:'1',text:'ilmasto ilmasto ilmaston ilmastossa ilmastolaki'}]).members['1'];
  assert.equal(cloud.terms.filter(t=>t.word.startsWith('ilmasto')).length,2);
  assert.equal(cloud.terms.find(t=>t.word==='ilmasto').count,2);
  assert.ok(cloud.terms.find(t=>t.word==='ilmastolaki'));
  assert.equal(cloudWordVariants('ilmasto','ilmaston'),true);
  assert.equal(cloudWordVariants('vero','verotus'),false);
});
test('speaker specificity favors a word used by fewer MPs when relative rates are equal',()=>{
  const speeches=[{mpId:'a',text:'metsäkato metsäkato ilmasto ilmasto'},
    {mpId:'b',text:'metsäkato terveys terveys'},
    {mpId:'c',text:'ilmasto terveys terveys'},
    {mpId:'d',text:'koulutus terveys terveys'}];
  const c=buildWordClouds(speeches).members.a.terms;
  assert.equal(c.find(t=>t.word==='metsäkato').corpusSpeakers,2);
  assert.ok(c.every(t=>Number.isFinite(t.specificity)&&t.specificity>0));
  const rarer=buildWordClouds([...speeches,{mpId:'b',text:'ilmasto'}, {mpId:'c',text:'koulutus'}]).members.a.terms;
  assert.ok(rarer.find(t=>t.word==='metsäkato').specificity>rarer.find(t=>t.word==='ilmasto').specificity);
});
test('directory contacts are read as data and identity mismatches fail closed',()=>{
  const data=[{kansanedustaja:1,avustajat:3},{henkilonro:2},'12',[4],{kutsumanimi:5,sukunimi:6,sahkoposti:7,puhelin:8,matkapuhelin:-1},'Testi','Avustaja','testi.avustaja@eduskunta.fi','09 432 1234'];
  const payload={nodes:[{data}]};
  assert.deepEqual(directoryContacts(payload,'12'),[{name:'Testi Avustaja',email:'testi.avustaja@eduskunta.fi',phone:'09 432 1234',mobile:''}]);
  assert.throws(()=>directoryContacts(payload,'13'),/identity mismatch/);
  assert.throws(()=>directoryContacts({},'12'),/missing/);
});
test('profile cleanup normalizes spacing and stray punctuation and retains official end dates',()=>{
  const p=normalizeMemberProfile({henkilonro:'1',edustajantoimenTila:'Entinen',kansanedustajuusPaattynytPvm:'2024-01-01',edustajatoimet:[{alkupvm:'2023-04-02'}],tyoura:{fi:[{tyopaikka:'  Pääsihteeri  (Järjestö/)\n',aikajakso:'2006-2007'}]}});
  assert.equal(p.career.fi[0].title,'Pääsihteeri (Järjestö)');
  assert.equal(p.terms[0].to,'2024-01-01');
  assert.equal(p.phone,'');
});
test('budget search finds deep moments by bilingual name, parent context or dotted code',()=>{
  const year={expense:[{code:'33',name:{fi:'Sosiaali',sv:'Social'},children:[{code:'3310',name:{fi:'Tuet'},children:[{code:'331057',name:{fi:'Asumistuki',sv:'Bostadsbidrag'},budget:10}]}]}]};
  const entries=budgetEntries(year,'expense');
  assert.equal(entries.length,3);
  assert.deepEqual(searchBudgetEntries(entries,'bostadsbidrag')[0].path,['33','3310','331057']);
  assert.equal(searchBudgetEntries(entries,'social asumistuki').length,1);
  assert.equal(searchBudgetEntries(entries,'33.10.57')[0].budget,10);
  assert.equal(searchBudgetEntries(entries,'puuttuu').length,0);
  assert.deepEqual(budgetEntries(undefined,'expense'),[]);
});

test('established clouds require recurrence on multiple days, not repeated turns in one debate',()=>{
  const speeches=Array.from({length:20},(_,i)=>({mpId:'1',date:'2025-01-01',text:i<3?'metsäkato metsäkato':'Suomen hallitus'}));
  assert.deepEqual(buildWordClouds(speeches).members['1'].terms,[]);
  speeches[1].date='2025-02-01';speeches[2].date='2025-03-01';
  const term=buildWordClouds(speeches).members['1'].terms[0];
  assert.equal(term.word,'metsäkato');assert.equal(term.days,3);assert.equal(term.count,6);
});
