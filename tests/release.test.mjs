import test from 'node:test';
import assert from 'node:assert/strict';
import { routeFromHash } from '../app-utils.js';
import { serializeCSV, serializeJSON } from '../data-tools.js';

test('malformed encoded route IDs remain recoverable, including truncated UTF-8', () => {
  for (const id of ['%','%ZZ','%E0%A4%A']) assert.deepEqual(routeFromHash('#/members/'+id),{page:'members',id});
  assert.deepEqual(routeFromHash('#/legislation/HE%201%2F2026%20vp'),{page:'legislation',id:'HE 1/2026 vp'});
});

test('CSV source text cannot execute spreadsheet formulas; negative numbers stay numeric', () => {
  const rows=[{value:'=1+1'},{value:'+SUM(A1)'},{value:'-1+1'},{value:'@SUM(A1)'},{value:'\t=1+1'},{value:'  =1+1'},{value:-123},{value:0},{value:'Tavallinen teksti'}];
  const csv=serializeCSV(rows);
  for (const row of rows.slice(0,6)) assert.ok(csv.includes("'"+row.value));
  assert.ok(csv.includes('\r\n-123\r\n0\r\nTavallinen teksti'));
  assert.deepEqual(JSON.parse(serializeJSON(rows)),rows);
  assert.equal(serializeCSV([{'=header':'safe'}]),"'=header\r\nsafe");
});
