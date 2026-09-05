import test from 'node:test';
import assert from 'node:assert/strict';
import { rowsToObjects, normalizeVote, buildIndexes, isInRange, deriveMembers } from '../scripts/lib.mjs';

test('rowsToObjects maps API column arrays into named records', () => {
  assert.deepEqual(rowsToObjects({ columnNames: ['id', 'name'], rowData: [['1', 'Ada']] }), [{ id: '1', name: 'Ada' }]);
});

test('date boundary includes 2 April 2023 and excludes earlier records', () => {
  assert.equal(isInRange('2023-04-02 12:00:00'), true);
  assert.equal(isInRange('2023-04-01 23:59:59'), false);
});

test('Finnish vote labels normalize into stable English keys', () => {
  assert.equal(normalizeVote('Jaa                 '), 'yes');
  assert.equal(normalizeVote('Ei'), 'no');
  assert.equal(normalizeVote('Tyhjää'), 'abstain');
  assert.equal(normalizeVote('Poissa'), 'absent');
});

test('buildIndexes aggregates MP, party and vote statistics', () => {
  const data = {
    votes: [{ id: 'v1', date: '2024-01-01', title: 'Vote', yes: 1, no: 1, abstain: 0, absent: 0 }],
    ballots: [
      { voteId: 'v1', mpId: '1', party: 'kok', choice: 'yes' },
      { voteId: 'v1', mpId: '2', party: 'sd', choice: 'no' }
    ],
    speeches: [{ id: 's1', mpId: '1', party: 'kok', date: '2024-01-01' }],
    members: [{ id: '1', firstName: 'A', lastName: 'One', party: 'kok' }, { id: '2', firstName: 'B', lastName: 'Two', party: 'sd' }]
  };
  const result = buildIndexes(data);
  assert.equal(result.members['1'].stats.yes, 1);
  assert.equal(result.members['1'].stats.speeches, 1);
  assert.equal(result.parties.kok.stats.participation, 100);
});

test('deriveMembers retains the newest identity and party record', () => {
  const members = deriveMembers(
    [{ mpId: '1', firstName: 'Uusi', lastName: 'Nimi', party: 'kok', date: '2025-02-01' }],
    [{ mpId: '1', firstName: 'Vanha', lastName: 'Nimi', party: 'sd', date: '2023-05-01' }]
  );
  assert.deepEqual(members, [{ id: '1', firstName: 'Uusi', lastName: 'Nimi', party: 'kok' }]);
});

test('party-line loyalty excludes tied party votes', () => {
  const data = {
    votes: [{ id: 'v1' }],
    ballots: [
      { voteId: 'v1', mpId: '1', party: 'kok', choice: 'yes' },
      { voteId: 'v1', mpId: '2', party: 'kok', choice: 'no' }
    ],
    speeches: [],
    members: [{ id: '1', party: 'kok' }, { id: '2', party: 'kok' }]
  };
  const result = buildIndexes(data);
  assert.equal(result.members['1'].stats.loyalty, 0);
  assert.equal(result.members['1'].stats.loyaltyVotes, 0);
});
