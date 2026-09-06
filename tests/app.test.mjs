import test from 'node:test';
import assert from 'node:assert/strict';
import { filterItems, percent, routeFromHash, hydrateBallots, pageSlice, choiceLabel, localized } from '../app-utils.js';

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

test('pageSlice exposes all items through successive pages', () => {
  const items = Array.from({ length: 55 }, (_, id) => id);
  assert.deepEqual(pageSlice(items, 1, 25), items.slice(0, 25));
  assert.deepEqual(pageSlice(items, 3, 25), items.slice(50));
});

test('choice labels never expose internal English keys', () => {
  assert.equal(choiceLabel('yes', 'fi'), 'jaa');
  assert.equal(choiceLabel('yes', 'sv'), 'ja');
  assert.equal(choiceLabel('absent', 'sv'), 'frånvarande');
});

test('localized selects Swedish fields and falls back to Finnish', () => {
  assert.equal(localized({ fi: 'Laki', sv: 'Lag' }, 'sv'), 'Lag');
  assert.equal(localized({ fi: 'Laki', sv: '' }, 'sv'), 'Laki');
});
