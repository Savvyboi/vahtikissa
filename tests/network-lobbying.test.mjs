import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLobbyingAnalysis } from '../network-lobbying.js';

const member = { id: '1', firstName: 'Anna', lastName: 'Aalto' };
const target = (id = 10, name = 'Anna Aalto', kind = 'mp') => ({ id, kind, fi: { name, organization: 'Eduskunta' }, sv: {} });
const row = (extra = {}) => ({ id: '100-1', notificationId: 100, diaryNumber: 'REO-100', companyId: '1234567-8', actor: 'Organisation Oy', topic: 'Public policy', targetIds: [10], period: { start: '2024-01-01', end: '2024-06-30' }, ...extra });
const snapshot = (lobbying, targets = [target()]) => ({ metadata: { generatedAt: '2024-10-01T10:00:00Z', transparencySource: 'https://public.api.avoimuusrekisteri.fi/open-data-activity-notification' }, lobbying, targets });

test('company IDs consolidate changed labels; declaration/topic/target dedup preserves distinct declarations', () => {
  const result = buildLobbyingAnalysis(snapshot([row(), row({ id: '100-2', actor: ' Organisation  OY ', topic: ' public  policy ' }), row({ id: '101-1', notificationId: 101 })]), [member]);
  assert.equal(result.organisations.length, 1);
  assert.equal(result.relationships.length, 2);
  assert.equal(result.coverage.duplicateAssociations, 1);
  assert.equal(result.organisations[0].declarations, 2);
  assert.equal(result.organisations[0].topics, 1);
  assert.equal(result.periods[0].organisations, 1);
  assert.equal(result.declarations[0].diaryNumber, 'REO-100');
  assert.deepEqual(result.relationships[0].sourceRecordIds, ['100-1', '100-2']);
  assert.equal(result.coverage.reconciliation, true);
});

test('named candidates never silently become reviewed MPs', () => {
  const result = buildLobbyingAnalysis(snapshot([row()]), [member]);
  assert.equal(result.targets[0].identityStatus, 'candidate-unreviewed');
  assert.deepEqual(result.targets[0].candidateMpIds, ['1']);
  assert.equal(result.relationships[0].mpId, undefined);
  assert.equal(result.publicationGate.personRankingsEnabled, false);
});

test('only explicit independent human crosswalk maps target IDs; conflicting reviews remain ambiguous', () => {
  const data = snapshot([row({ targetIds: [10, 11] })], [target(), target(11)]);
  const review = { targetId: 10, mpId: '1', reviewedBy: 'Independent reviewer', reviewedAt: '2024-09-01', independentHuman: true };
  const ignored = buildLobbyingAnalysis(data, [member], { crosswalk: [{ ...review, independentHuman: false }] });
  assert.equal(ignored.relationships[0].mpId, undefined);
  const result = buildLobbyingAnalysis(data, [member], { crosswalk: [review, { ...review, targetId: 11 }] });
  assert.deepEqual(result.relationships.map(relation => relation.mpId), ['1', '1']);
  assert.equal(result.publicationGate.personRankingsEnabled, false);
  const conflict = buildLobbyingAnalysis(data, [member, { id: '2', firstName: 'Other', lastName: 'Person' }], { crosswalk: [review, { ...review, mpId: '2' }] });
  assert.equal(conflict.targets[0].identityStatus, 'ambiguous-reviewed');
  assert.equal(conflict.relationships[0].mpId, undefined);
});

test('recurring recipients, unmatched, ambiguous, non-MP and missing targets stay separate', () => {
  const result = buildLobbyingAnalysis(snapshot([row({ targetIds: [10, 11, 12, 13] })], [target(), target(11, 'Unmatched Name'), target(12, '', 'ministry')]), [member, { ...member, id: '2' }]);
  assert.equal(result.coverage.identityStatuses.ambiguous, 1);
  assert.equal(result.coverage.identityStatuses.unmatched, 1);
  assert.equal(result.coverage.identityStatuses['non-mp'], 1);
  assert.equal(result.coverage.identityStatuses['missing-target'], 1);
});

test('only closed valid whole reporting periods fit the selected coverage', () => {
  const result = buildLobbyingAnalysis(snapshot([
    row(), row({ id: '101', period: { start: '2024-07-01', end: '2024-10-01' } }), row({ id: '102', period: { start: '', end: '2024-06-30' } }), row({ id: '103', period: { start: '2023-07-01', end: '2023-12-31' } })
  ]), [member], { from: '2024-01-01', to: '2024-06-30' });
  assert.equal(result.relationships.length, 1);
  assert.equal(result.coverage.excluded, 3);
  assert.equal(result.coverage.excludedAssociations, 3);
  assert.equal(result.coverage.reconciliation, true);
  assert.deepEqual(result.relationships[0].period, { start: '2024-01-01', end: '2024-06-30' });
  const partial = buildLobbyingAnalysis(snapshot([row()]), [member], { from: '2024-02-01' });
  assert.equal(partial.relationships.length, 0);
});

test('missing company IDs remain unresolved and do not consolidate by display label', () => {
  const result = buildLobbyingAnalysis(snapshot([row({ companyId: '' }), row({ id: '101-1', notificationId: 101, companyId: '' })]), [member]);
  assert.equal(result.organisations.length, 2);
  assert.equal(result.organisations[0].identityStatus, 'missing-company-id');
});

test('lobbying output and source identities remain reproducible', () => {
  const source = snapshot([row()]);
  assert.deepEqual(buildLobbyingAnalysis(source, [member]), buildLobbyingAnalysis(source, [member]));
  const result = buildLobbyingAnalysis(source, [member]);
  assert.equal(result.relationships[0].notificationId, '100');
  assert.equal(result.relationships[0].topicId, '100-1');
  assert.equal(result.relationships[0].sourceUrl, source.metadata.transparencySource);
  assert.equal(result.coverage.relationships, result.relationships.length);
});

test('duplicate target IDs inside one topic reconcile without inflating association counts', () => {
  const result = buildLobbyingAnalysis(snapshot([row({ targetIds: [10, 10, 10] })]), [member]);
  assert.equal(result.relationships.length, 1);
  assert.equal(result.coverage.inputAssociations, 3);
  assert.equal(result.coverage.duplicateAssociations, 2);
  assert.equal(result.coverage.reconciliation, true);
});
