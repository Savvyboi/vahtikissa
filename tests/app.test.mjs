import test from 'node:test';
import assert from 'node:assert/strict';
import { filterItems, percent, routeFromHash } from '../app-utils.js';

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
