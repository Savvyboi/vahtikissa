import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommitteeAnalysis, compareLayers } from '../network-institutions.js';

const row = (from, to, extra = {}) => ({ id: 'A', name: { fi: 'Talousvaliokunta', sv: 'Ekonomiutskottet' }, role: { fi: 'Jäsen' }, from, to, ...extra });
const profiles = members => ({ metadata: { generatedAt: '2024-01-31T13:00:00Z' }, members: Object.fromEntries(members.map(member => [member.id, member])) });
const build = members => buildCommitteeAnalysis(profiles(members), [], { from: '2024-01-01', to: '2024-01-31' });

test('committee disjoint and touching half-open intervals do not create overlap', () => {
  const result = build([{ id: '1', committees: [row('2024-01-01', '2024-01-04')] }, { id: '2', committees: [row('2024-01-05', '2024-01-10')] }, { id: '3', committees: [row('2024-01-11', '2024-01-15')] }]);
  assert.equal(result.pairs.length, 0);
});

test('open appointments cap at selected inclusive coverage end', () => {
  const result = build([{ id: '1', committees: [row('2024-01-25', '')] }, { id: '2', committees: [row('2024-01-29', '')] }]);
  assert.equal(result.memberships[0].to, '2024-02-01');
  assert.equal(result.pairs[0].sharedDays, 3);
  assert.equal(result.pairs[0].weightedDays, 3);
});

test('duplicate translated/history roles do not multiply overlap; historical names canonicalize', () => {
  const result = buildCommitteeAnalysis(profiles([
    { id: '1', committees: [row('2024-01-01', '2024-01-10'), row('2024-01-03', '2024-01-08', { role: { fi: 'Puheenjohtaja' } })], bodies: { fi: [{ name: 'Vanha nimi', role: 'Jäsen', from: '2024-01-01', to: '2024-01-10' }], sv: [{ name: 'Ekonomiutskottet', role: 'medlem', from: '2024-01-01', to: '2024-01-10' }] } },
    { id: '2', committees: [row('2024-01-01', '2024-01-10')] }
  ]), [], { from: '2024-01-01', to: '2024-01-31', bodyAliases: { 'Vanha nimi': 'A' } });
  assert.equal(result.pairs[0].sharedDays, 10);
  assert.equal(result.pairs[0].bodies.length, 1);
  assert.deepEqual(result.pairs[0].bodies[0].rolesA, ['chair', 'member']);
  assert.equal(result.memberships.filter(record => record.mpId === '1' && record.role === 'member').length, 1);
});

test('committee correction uses distinct members active during each segment', () => {
  const result = build([
    { id: '1', committees: [row('2024-01-01', '2024-01-10')] },
    { id: '2', committees: [row('2024-01-01', '2024-01-10')] },
    { id: '3', committees: [row('2024-01-06', '2024-01-10')] }
  ]);
  const pair = result.pairs.find(record => record.a === '1' && record.b === '2');
  assert.equal(pair.sharedDays, 10);
  assert.equal(pair.weightedDays, 7.5);
  assert.deepEqual(pair.bodies[0].intervals.map(interval => interval.activeMembers), [2, 3]);
});

test('unknown/invalid dates remain explicit exclusions and filtering preserves evidence', () => {
  const result = buildCommitteeAnalysis(profiles([
    { id: '1', sourceUrl: 'https://example.test/1', committees: [row('', ''), row('2024-02-30', ''), row('2024-01-05', '2024-01-01'), row('2024-01-01', '')] },
    { id: '2', committees: [row('2024-01-01', '')] }
  ]), [{ id: '1' }], { from: '2024-01-10', to: '2024-01-11' });
  assert.equal(result.coverage.excluded, 3);
  assert.equal(result.memberships.length, 1);
  assert.equal(result.memberships[0].from, '2024-01-10');
  assert.equal(result.memberships[0].days, 2);
  assert.equal(result.memberships[0].sourceUrl, 'https://example.test/1');
});

test('layer comparison keeps units separate and absent observations unavailable', () => {
  const result = compareLayers('1', null, { pairs: [{ a: '1', b: '2', sharedDays: 7 }], coverage: { from: '2024-01-01' } });
  assert.equal(result.layers.length, 2);
  assert.equal(result.layers[0].available, false);
  assert.equal(result.layers[1].relationships[0].sharedDays, 7);
});

test('institutional output is deterministic for identical snapshots', () => {
  const source = [{ id: '2', committees: [row('2024-01-01', '')] }, { id: '1', committees: [row('2024-01-01', '')] }];
  assert.deepEqual(build(source), build(source));
});

test('inclusive source end dates preserve one-day appointments and derive exclusive boundaries', () => {
  const result = build([{ id: '1', committees: [row('2024-01-05', '2024-01-05')] }, { id: '2', committees: [row('2024-01-05', '2024-01-05')] }]);
  assert.equal(result.pairs[0].sharedDays, 1);
  assert.equal(result.memberships[0].to, '2024-01-06');
  assert.equal(result.method.sourceEndConvention, 'inclusive');
});

test('explicit exclusive input convention retains touching-endpoint semantics', () => {
  const source = profiles([{ id: '1', committees: [row('2024-01-01', '2024-01-05')] }, { id: '2', committees: [row('2024-01-05', '2024-01-10')] }]);
  assert.equal(buildCommitteeAnalysis(source, [], { from: '2024-01-01', to: '2024-01-31', sourceEndConvention: 'exclusive' }).pairs.length, 0);
  assert.throws(() => buildCommitteeAnalysis(source, [], { sourceEndConvention: 'unknown' }), /convention/u);
});

test('UTC civil-day arithmetic is unchanged across Finnish daylight-saving transition', () => {
  const source = profiles([{ id: '1', committees: [row('2024-03-30', '2024-03-31')] }, { id: '2', committees: [row('2024-03-30', '2024-03-31')] }]);
  const result = buildCommitteeAnalysis(source, [], { from: '2024-03-30', to: '2024-03-31' });
  assert.equal(result.pairs[0].sharedDays, 2);
  assert.equal(result.memberships[0].to, '2024-04-01');
});
