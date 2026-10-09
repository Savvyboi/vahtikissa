import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWordClouds, matchRanges, filterResearchSpeeches, concordance, researchSummary, speechSearchLink } from '../speech-research.js';
import { normalizeMemberProfile, buildMemberProfiles } from '../scripts/member-profiles.mjs';
import { routeFromHash } from '../app-utils.js';

test('word clouds remove Finnish/Swedish function words and salutations, preserving subject terms',()=>{
  const output=buildWordClouds([{mpId:'1',text:'Arvoisa puhemies! Tämä on ja että. Värderade talman, och det är. Ilmasto ilmasto klimat. Hallitus.'}]);
  assert.deepEqual(output.members['1'].terms,[{word:'ilmasto',count:2,speeches:1},{word:'hallitus',count:1,speeches:1},{word:'klimat',count:1,speeches:1}]);
  assert.equal(output.method.lemmatized,false);
});
test('clouds count occurrences and distinct speeches separately, isolate MPs and update on new speeches',()=>{
  const speeches=[{mpId:'1',text:'Koulutus koulutus koulutuksen'},{mpId:'2',text:'Talous'}];
  const first=buildWordClouds(speeches).members;
  const second=buildWordClouds([...speeches,{mpId:'1',text:'koulutus'}]).members;
  assert.deepEqual(first['1'].terms[0],{word:'koulutus',count:2,speeches:1});
  assert.deepEqual(second['1'].terms[0],{word:'koulutus',count:3,speeches:2});
  assert.deepEqual(first['2'],second['2']);
  assert.ok(first['1'].terms.some(term=>term.word==='koulutuksen'));
});
test('MPs without recorded speeches have an explicit empty cloud',()=>{
  assert.deepEqual(buildWordClouds([],60,['no-speeches']).members['no-speeches'],{speeches:0,words:0,filteredWords:0,terms:[]});
});
test('exact matching respects Unicode word boundaries; stems include inflected forms',()=>{
  assert.equal(matchRanges('Ilmasto ilmastosta ilmasto,','ilmasto','word').length,2);
  assert.equal(matchRanges('Ilmasto ilmastosta ilmasto,','ilmasto','contains').length,3);
  assert.equal(matchRanges('Svenska: hälso- och sjukvård','HÄLSO OCH SJUKVÅRD','phrase').length,1);
  assert.equal(matchRanges('eläke eläkkeet','eläke','word').length,1);
  assert.equal(matchRanges('aa aa aa','aa aa','phrase').length,1);
  assert.deepEqual(matchRanges('test',''),[]);
});
test('research filters keep metadata matches separate from transcript matches and support exclusions',()=>{
  const speeches=[{id:'a',agenda:'Talous'},{id:'b',agenda:'Muu'}],texts={a:'Koulutus',b:'Talous ja verotus'};
  assert.deepEqual(filterResearchSpeeches(speeches,texts,{query:'talous',scope:'text'}),[speeches[1]]);
  assert.deepEqual(filterResearchSpeeches(speeches,texts,{query:'talous',scope:'all'}),speeches);
  assert.deepEqual(filterResearchSpeeches(speeches,texts,{query:'talous',scope:'all',exclude:'verotus'}),[speeches[0]]);
});
test('concordances provide bounded context and leave HTML as data for safe rendering',()=>{
  const rows=concordance('Aluksi ilmasto, sitten ilmasto lopuksi.','ilmasto','word',1,8);
  assert.equal(rows.length,1);assert.equal(rows[0].match,'ilmasto');assert.equal(rows[0].before,'aluksi ');
  assert.match(rows[0].after,/…$/);
});
test('monthly rates use all filtered corpus words rather than only matching speeches',()=>{
  const speeches=[{id:'a',date:'2024-01-01'},{id:'b',date:'2024-01-20'},{id:'c',date:'2024-02-01'}];
  const report=researchSummary(speeches,{a:'talous talous kasvaa',b:'koulutus kehittyy',c:'talous'},'talous','word');
  assert.equal(report.speeches,3);assert.equal(report.matchingSpeeches,2);assert.equal(report.occurrences,3);
  assert.equal(report.words,6);assert.equal(report.per10000Words,5000);
  assert.deepEqual(report.months[0],{month:'2024-01',speeches:2,matchingSpeeches:1,occurrences:2,words:5,per10000Words:4000});
});
test('research links round-trip Nordic words, MP identity and exact mode without altering routes',()=>{
  const link=speechSearchLink({query:'hälsa & utbildning',mpId:'123',mode:'phrase'});
  assert.deepEqual(routeFromHash(link),{page:'speeches',id:null});
  const params=new URLSearchParams(link.split('?')[1]);
  assert.equal(params.get('q'),'hälsa & utbildning');assert.equal(params.get('mp'),'123');assert.equal(params.get('match'),'phrase');
  assert.deepEqual(routeFromHash('#/speeches/PUH%201?q=talous'),{page:'speeches',id:'PUH 1'});
});
test('official profiles retain sourced education, employment, roles and dates without invented contacts',()=>{
  const member={henkilonro:'12',edustajantoimenTila:'Keskeytynyt',ammatti:{fi:'opettaja',sv:'lärare'},koulutukset:[{vuosi:2009,nimi:{fi:'maisteri'},oppilaitos:{fi:'Yliopisto'}}],tyoura:{fi:[{tyopaikka:'Koulu',aikajakso:'2009-2015'}]},valiokuntajasenyydet:[{valiokuntaTunnus:'SIV01',valiokuntaNimi:{fi:'Sivistysvaliokunta'},rooli:{fi:'Varajäsen'},alkupvm:'2023-04-19',loppupvm:'2024-07-15'}]};
  const p=normalizeMemberProfile(member);
  assert.equal(p.email,'');assert.equal(p.phone,'');assert.equal(p.status,'Keskeytynyt');
  assert.deepEqual(p.education[0],{year:2009,degree:{fi:'maisteri',sv:''},institution:{fi:'Yliopisto',sv:''}});
  assert.deepEqual(p.career.fi,[{title:'Koulu',period:'2009-2015'}]);
  assert.equal(p.committees[0].to,'2024-07-15');assert.equal(p.committees[0].role.fi,'Varajäsen');
  assert.equal(p.sourceUrl,'https://api.eduskunta.fi/api/v1/kansanedustajat/12');
});
test('incomplete profile snapshots fail before replacing published data',()=>{
  assert.throws(()=>buildMemberProfiles([{henkilonro:'1'}],['1','2']),/Missing official profile: 2/);
});

test('clouds filter inflected pronouns and common conjunctions, and omit bracketed editorial notes',()=>{
  const output=buildWordClouds([{mpId:'1',text:'Kun jos jotka tässä tästä tähän tällä oli. Eli esimerkiksi erittäin. Ilmasto [Puhemies koputtaa] [Kello soi] EU YK FN.'}]);
  assert.deepEqual(output.members['1'].terms.map(term=>term.word).sort(),['eu','fn','ilmasto','yk']);
});

test('rejected partial-word matches do not hide overlapping valid exact phrases',()=>{
  assert.equal(matchRanges('epätalous talous talous','talous talous','phrase').length,1);
});
