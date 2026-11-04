import test from 'node:test';
import assert from 'node:assert/strict';
import { votingComparisonRows, orderVotingComparisons, agreementWidth } from '../relationship-visuals.js';

test('voting comparisons retain source scores, resolve both pair orientations and flag small samples at the configured threshold', () => {
  const members=[{id:'1',firstName:'Aino',lastName:'Testi'},{id:'2',firstName:'Bertil',lastName:'Testi'}];
  const data={method:{minCommon:30},partyByMember:{'2':'sd'},pairs:[
    {a:1,b:2,common:29,agreement:.987654321},
    {a:2,b:1,common:30,agreement:.6},
    {a:'1',b:'99',common:100,agreement:null,lowSupport:true}
  ]};
  const before=structuredClone(data),rows=votingComparisonRows(data,'1',members);
  assert.deepEqual(rows.map(row=>row.neighbour),['2','2','99']);
  assert.deepEqual(rows.map(row=>row.lowSupport),[true,false,true]);
  assert.equal(rows[0].name,'Bertil Testi');assert.equal(rows[0].party,'sd');
  assert.equal(rows[0].agreement,.987654321,'The visual model must not round source precision');
  assert.equal(rows[2].name,'99');assert.equal(rows[2].party,'');
  assert.deepEqual(data,before,'Visual preparation leaves the analytical source untouched');
  assert.equal(votingComparisonRows({pairs:{one:{a:'1',b:'2',common:9}},method:{minCommon:10}},1,members)[0].lowSupport,true);
  assert.deepEqual(votingComparisonRows({},'1',members),[]);
});

test('voting rankings treat exact scores as ties, keep missing scores last in either direction and use source precision', () => {
  const rows=[{name:'Östen',agreement:1},{name:'Zara',agreement:1},{name:'Åke',agreement:1},{name:'Missing B',agreement:null},{name:'Low',agreement:.3},{name:'Missing A'},{name:'Near',agreement:.9999999}];
  const before=structuredClone(rows);
  assert.deepEqual(orderVotingComparisons(rows,'desc','sv').map(row=>row.name),['Zara','Åke','Östen','Near','Low','Missing A','Missing B']);
  assert.deepEqual(orderVotingComparisons(rows,'asc','sv').map(row=>row.name),['Low','Near','Zara','Åke','Östen','Missing A','Missing B']);
  assert.deepEqual(rows,before);
});

test('visual percentage widths clamp to a valid 0–100 scale and unavailable values never appear as full bars', () => {
  for(const value of [null,undefined,NaN,Infinity,-Infinity,'0.8'])assert.equal(agreementWidth(value),0);
  assert.equal(agreementWidth(-.1),0);assert.equal(agreementWidth(0),0);
  assert.equal(agreementWidth(.325),32.5);assert.equal(agreementWidth(1),100);assert.equal(agreementWidth(1.2),100);
});
