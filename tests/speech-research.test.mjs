import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWordClouds, matchRanges, filterResearchSpeeches, concordance, researchSummary, speechSearchLink } from '../speech-research.js';
import { normalizeMemberProfile, buildMemberProfiles } from '../scripts/member-profiles.mjs';
import { routeFromHash } from '../app-utils.js';

test('word clouds remove Finnish/Swedish function words and institutional boilerplate, preserving policy terms',()=>{
  const output=buildWordClouds([{mpId:'1',text:'Arvoisa puhemies! Tämä on ja että. Värderade talman, och det är. Ilmasto ilmasto klimat. Hallitus hallituksen Suomen suomessa regeringen Finlands.'}]);
  assert.deepEqual(output.members['1'].terms.map(({word,count,speeches})=>({word,count,speeches})),[{word:'ilmasto',count:2,speeches:1},{word:'klimat',count:1,speeches:1}]);
  assert.ok(output.members['1'].terms.every(term=>Number.isFinite(term.score)&&term.score>0));
  assert.equal(output.method.lemmatized,false);
});
test('clouds count occurrences and distinct speeches separately, isolate MPs and update on new speeches',()=>{
  const speeches=[{mpId:'1',text:'Koulutus koulutus koulutuksen'},{mpId:'2',text:'Talous'}];
  const first=buildWordClouds(speeches).members;
  const second=buildWordClouds([...speeches,{mpId:'1',text:'koulutus'}]).members;
  assert.equal(first['1'].terms.find(term=>term.word==='koulutus').count,2);
  const updated=second['1'].terms.find(term=>term.word==='koulutus');
  assert.equal(updated.count,3);assert.equal(updated.speeches,2);assert.equal(updated.corpusCount,3);
  assert.deepEqual(first['2'].terms.map(({word,count,speeches})=>({word,count,speeches})),second['2'].terms.map(({word,count,speeches})=>({word,count,speeches})));
  assert.notEqual(first['2'].terms[0].score,second['2'].terms[0].score); // the reference corpus updates too
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


test('clouds rank recurring distinctive words using normalized usage in the other MPs, with a repeat threshold',()=>{
  const speeches=[];
  for(let i=0;i<6;i++){
    speeches.push({mpId:'specialist',text:'energia energia energia metsäkato metsäkato'+(i===0?' kertamaininta':'')});
    speeches.push({mpId:'other',text:'energia '.repeat(8)+'terveys '.repeat(6)});
    speeches.push({mpId:'third',text:'energia '.repeat(8)+'koulutus '.repeat(6)});
  }
  const output=buildWordClouds(speeches),cloud=output.members.specialist;
  assert.deepEqual(cloud.terms.map(term=>term.word),['metsäkato']);
  const term=cloud.terms[0];assert.equal(term.count,12);assert.equal(term.speeches,6);assert.equal(term.corpusCount,12);
  const relative=((12+.5)/(31+1))/((0+.5)/(168+1));
  assert.equal(term.relativeFrequency,relative);assert.equal(term.score,Math.sqrt(12)*Math.log2(relative));
  assert.equal(output.method.ranking,'sqrt-count-log2-relative-frequency');
  assert.equal(output.method.reference,'other-mps');
  assert.ok(!cloud.terms.some(term=>term.word==='kertamaininta'));
  assert.deepEqual(buildWordClouds(speeches,1).members.specialist.terms,cloud.terms);
});

test('empty reference text and institutional-only speeches do not produce invalid scores',()=>{
  const clouds=buildWordClouds([{mpId:'1',text:'ilmasto ilmasto'},{mpId:'2',text:'Suomen hallitus, regeringens proposition.'}],60,['3']).members;
  assert.equal(clouds['1'].terms[0].score,Math.sqrt(2));
  assert.deepEqual(clouds['2'].terms,[]);assert.deepEqual(clouds['3'].terms,[]);
});
