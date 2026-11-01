import test from 'node:test';
import assert from 'node:assert/strict';
import {tableSortValue,sortTableRows} from '../relationship-tables.js';
import {relationshipLabel} from '../relationship-labels.js';

test('relationship numeric cells handle Finnish grouping, percentages, ratios and missing values',()=>{
  assert.equal(tableSortValue('1\u00a0234,567 %'),1234.567);
  assert.equal(tableSortValue('1\u202f234.567 %'),1234.567);
  assert.equal(tableSortValue('2123 / 2806 · Vähän näyttöä'),2123);
  assert.equal(tableSortValue('—'),null);
  assert.equal(tableSortValue('2026-10-21'), '2026-10-21');
  assert.equal(tableSortValue('Anna-Kaisa Ikonen'),'Anna-Kaisa Ikonen');
});

test('column sorting is numeric and stable, keeps missing values last in both directions, and preserves source precision',()=>{
  const rows=[{id:'missing',value:null},{id:'ten',value:10},{id:'two',value:2},{id:'one',value:1.000001},{id:'tie',value:1.000001},{id:'near',value:1.000002}];
  const before=structuredClone(rows);
  assert.deepEqual(sortTableRows(rows,r=>r.value).map(r=>r.id),['one','tie','near','two','ten','missing']);
  assert.deepEqual(sortTableRows(rows,r=>r.value,'desc').map(r=>r.id),['ten','two','near','one','tie','missing']);
  assert.deepEqual(rows,before,'Sorting must not mutate or round the underlying records');
});

test('sorting occurs before a visible row limit and orders Scandinavian names with the interface locale',()=>{
  const rows=Array.from({length:450},(_,i)=>({value:450-i}));
  assert.deepEqual(sortTableRows(rows,r=>r.value).slice(0,3).map(r=>r.value),[1,2,3]);
  assert.deepEqual(sortTableRows(['Östen','Åke','Zara','Äsa'],r=>r,'asc','sv'),['Zara','Åke','Äsa','Östen']);
});

test('relationship table headings and analysis enums have Finnish and Swedish labels',()=>{
  const keys=['MP','Party','Agree / common','Yes/no %','Contested %','Matter %','Session %','Evidence','Recorded party baseline','Group size','Alignment','Shared body-days','Size-corrected days','Topic','Speeches','Per 10,000','Coverage','candidate-unreviewed','ambiguous-reviewed','rule-match-unvalidated','exploratory-unstable','unavailable-unstable','rising','falling','contains','yes','no','true','false'];
  for(const lang of ['fi','sv'])for(const key of keys)assert.notEqual(relationshipLabel(key,lang),key,lang+': '+key);
  assert.equal(relationshipLabel('Yes/no %','en'),'Yes/no %');
  assert.equal(relationshipLabel('Official source text','fi'),'Official source text','Original source text is preserved');
});
