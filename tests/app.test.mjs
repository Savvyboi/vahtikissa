import test from 'node:test';
import assert from 'node:assert/strict';
import { filterItems, percent, routeFromHash, hydrateBallots } from '../app-utils.js';

test('filterItems searches Finnish text case-insensitively', () => {
  const items = [{ title: 'Julkisen talouden suunnitelma', party: 'kok' }, { title: 'Kalastuslaki', party: 'kesk' }];
  assert.equal(filterItems(items, 'TALOUDEN').length, 1);
});

test('percent handles an empty denominator safely', () => {
  assert.equal(percent(0, 0), 0);
  assert.equal(percent(1, 4), 25);
});

test('hash parser supports details and defaults to overview', () => {
  assert.deepEqual(routeFromHash('#/members/123'), { page: 'members', id: '123' });
  assert.deepEqual(routeFromHash(''), { page: 'overview', id: null });
});

test('hydrateBallots joins packed ballots with MP names', () => {
  const ballots = [['2026-72-2', '1504', 'kok', 'yes']];
  const members = [{ id: '1504', firstName: 'Pauli', lastName: 'Aalto-Setälä', party: 'kok' }];
  assert.deepEqual(hydrateBallots(ballots, members), [{
    voteId: '2026-72-2', mpId: '1504', party: 'kok', choice: 'yes',
    firstName: 'Pauli', lastName: 'Aalto-Setälä'
  }]);
});

test('hydrateBallots gives a stable fallback for a missing MP record', () => {
  assert.deepEqual(hydrateBallots([['v1', '999', 'sit', 'absent']], []), [{
    voteId: 'v1', mpId: '999', party: 'sit', choice: 'absent',
    firstName: '', lastName: '', id: '999'
  }]);
});
