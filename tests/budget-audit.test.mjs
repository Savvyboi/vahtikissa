import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { budgetTotals } from '../budget-utils.js';

test('budget net borrowing excludes repayments owed to the state for every metric', () => {
  const year = {
    income: [{ code: '15', budget: 11131501000, original: 105, actual: 13268664279, children: [
      { code: '1501', budget: 70881000, original: 5, actual: 175522666 },
      { code: '1503', budget: 11060620000, original: 100, actual: 13093141613, children: [
        { code: '150301', budget: 11060620000, original: 100, actual: 13093141613 }
      ] }
    ] }],
    expense: [{ budget: 11131501000, original: 105, actual: 13268664279 }]
  };
  for (const [metric, expected, repayment] of [['budget', 11060620000, 70881000], ['original', 100, 5], ['actual', 13093141613, 175522666]]) {
    const totals = budgetTotals(year, metric);
    assert.equal(totals.borrowing, expected);
    assert.equal(totals.revenue, repayment);
    assert.equal(totals.balance, -expected);
  }
});

test('budget borrowing does not misclassify a loan aggregate or repayment when its net moment is missing', () => {
  assert.equal(budgetTotals({ income: [{ code: '15', budget: 20 }] }).borrowing, 0);
  assert.equal(budgetTotals({ income: [{ code: '15', budget: 25, children: [{ code: '1503', budget: 20 }, { code: '1501', budget: 5 }] }] }).borrowing, 0);
  assert.equal(budgetTotals({ income: [{ code: '15', budget: 5, children: [{ code: '1501', budget: 5 }] }] }).borrowing, 0);
});

async function influenceHarness({ failFirst = false } = {}) {
  const source = await readFile(new URL('../civic-apps.js', import.meta.url), 'utf8');
  const stateSource = source.slice(source.indexOf('const influenceState ='), source.indexOf('const colors ='));
  const renderSource = source.slice(source.indexOf('export async function renderInfluence(')).replace(/^export /, '');
  const root = { dataset: { view: 'full' }, page: false, querySelector(selector) { return selector === '.influence-page' && this.page ? {} : null; } };
  const location = { hash: '#/influence/123' }, extraStates = new Map();
  const members = [{ id: '123', firstName: 'Ada', lastName: 'Edustaja' }, { id: '124', firstName: 'Bo', lastName: 'Edustaja' }];
  let attempts = 0, retry, paints = 0, api;
  let loader = async () => { if (++attempts === 1 && failFirst) throw new Error('Temporary network failure'); return {}; };
  api = runInNewContext(stateSource + '\n' + renderSource + '\n({state:influenceState,render:renderInfluence})', {
    extraStates, cache: new Map([['./data/influence.json', true]]), location, document: { documentElement: { lang: 'fi' } },
    load: (...args) => loader(...args), loading: () => { root.page = false; }, prepareInfluenceData: () => {},
    renderInfluenceContent: () => { root.page = true; paints++; },
    errorView: (_root, _lang, _escape, _error, handler) => { root.page = false; retry = handler; }
  });
  return {
    state: api.state, extraStates, root, location,
    render: (memberId = '123') => api.render(root, 'fi', value => value, members, memberId),
    retry: () => retry(), hasRetry: () => typeof retry === 'function', paints: () => paints,
    setLoader: value => { loader = value; }
  };
}

test('focused disclosures discard every stale quick and advanced filter on route entry', async () => {
  const h = await influenceHarness();
  Object.assign(h.state, { tab: 'lobbying', query: 'old search', year: '2020', kind: 'assistant', mp: 'Old MP', party: 'ps', actor: 'Old actor', method: 'mail', category: 'Old industry', categoryQuery: 'old', exclusionOpen: true, limit: 900 });
  h.state.excludedCategories.add('Old industry');
  for (const tab of ['gifts', 'interests', 'lobbying']) h.extraStates.set('influence-' + tab, { from: '2020-01-01', facets: { actor: { include: ['Old actor'] } } });
  h.extraStates.set('election-parties', { query: 'keep' });
  await h.render();
  for (const [key, value] of Object.entries({ tab: 'interests', mp: 'Ada Edustaja', query: '', year: 'all', kind: 'all', party: 'all', actor: 'all', method: 'all', category: 'all', categoryQuery: '', exclusionOpen: false, limit: 100 })) assert.equal(h.state[key], value, key);
  assert.equal(h.state.excludedCategories.size, 0);
  assert.equal(h.extraStates.size, 1);
  assert.equal(h.extraStates.has('election-parties'), true);
  Object.assign(h.state, { tab: 'gifts', query: 'chosen filter' });
  h.extraStates.set('influence-gifts', { min: '100' });
  await h.render();
  assert.equal(h.state.tab, 'gifts');
  assert.equal(h.state.query, 'chosen filter');
  assert.equal(h.extraStates.has('influence-gifts'), true);
  h.location.hash = '#/influence/124';
  await h.render('124');
  assert.equal(h.state.mp, 'Bo Edustaja');
  assert.equal(h.state.tab, 'interests');
  assert.equal(h.state.query, '');
  assert.equal(h.extraStates.has('influence-gifts'), false);
  h.location.hash = '#/influence';
  await h.render('');
  assert.equal(h.state.mp, 'all');
  assert.equal(h.state.tab, 'gifts');
});

test('retrying a focused disclosure request preserves its member and initial tab', async () => {
  const h = await influenceHarness({ failFirst: true });
  await h.render();
  assert.equal(h.hasRetry(), true);
  assert.equal(h.paints(), 0);
  await h.retry();
  assert.equal(h.location.hash, '#/influence/123');
  assert.equal(h.state.mp, 'Ada Edustaja');
  assert.equal(h.state.tab, 'interests');
  assert.equal(h.paints(), 1);
});

test('a stale disclosure response cannot replace current filters or paint another route', async () => {
  const h = await influenceHarness();
  let resolve;
  h.setLoader(() => new Promise(done => { resolve = done; }));
  h.state.query = 'keep current filters';
  const pending = h.render();
  h.location.hash = '#/members/124';
  resolve({});
  await pending;
  assert.equal(h.state.query, 'keep current filters');
  assert.equal(h.state.mp, 'all');
  assert.equal(h.paints(), 0);
});
