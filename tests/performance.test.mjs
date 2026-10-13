import test from 'node:test';
import assert from 'node:assert/strict';
import { parliamentChunks } from '../scripts/build-parliament-data.mjs';
import { createParliamentLoader } from '../parliament-data.js';

const fixture = () => ({
  metadata: { generatedAt: '2026-10-11T20:00:00Z', counts: { speeches: 2, ballots: 3 } },
  votes: [{ id: 'v1', document: 'HE 1/2026 vp' }, { id: 'v2' }],
  ballots: [['v1', '1', 'kok', 'yes'], ['v1', '2', 'sd', 'no'], ['v2', '1', 'kok', 'absent']],
  speeches: [{ id: 's1', mpId: '1', session: '2026-96' }, { id: 's2', mpId: '2', session: '2026-94' }],
  members: [{ id: '1', firstName: 'A', lastName: 'One' }, { id: '2', firstName: 'B', lastName: 'Two' }],
  sessions: [{id:'2026-96',voteIds:[],speechCount:1},{id:'2026-94',voteIds:['v1'],speechCount:1}], parties: [], legislation: [{ id: 'HE 1/2026 vp', voteIds: ['v1'] }]
});
const committeeIndex = { matters: { 'HE 1/2026 vp': [{ id: 'VaV', name: 'Valtiovarainvaliokunta' }] } };
function loaderFixture() {
  const chunks = parliamentChunks(fixture(), committeeIndex), requests = [];
  const loader = createParliamentLoader(async url => {
    requests.push(url);
    return structuredClone(chunks.get(url.split('/').at(-1).split('?')[0]));
  });
  return { chunks, requests, loader };
}

test('browser payloads retain every record and only include the requested MP or vote', () => {
  const data = fixture(), chunks = parliamentChunks(data, committeeIndex), core = chunks.get('core.json');
  assert.deepEqual(core.metadata, data.metadata);
  for (const key of ['ballots', 'speeches', 'legislation']) assert.equal(key in core, false);
  assert.deepEqual(chunks.get('vote-0.json').ballots, data.ballots.slice(0, 2));
  assert.deepEqual(chunks.get('vote-0.json').legislation[0].committees, committeeIndex.matters['HE 1/2026 vp']);
  assert.deepEqual(chunks.get('member-0.json').speeches, [data.speeches[0]]);
  assert.deepEqual(chunks.get('member-0.json').ballots, [data.ballots[0], data.ballots[2]]);
  const allBallots = data.votes.flatMap((_, i) => chunks.get(`vote-${i}.json`).ballots);
  assert.equal(allBallots.length, data.ballots.length);
  assert.deepEqual(chunks.get('speeches.json').speeches, data.speeches);
  assert.equal(chunks.get('party-votes.json').partyVotes.v1.kok.yes, 1);
  assert.equal(chunks.get('party-votes.json').partyVotes.v2.kok.absent, 1);
  assert.deepEqual(data, fixture(), 'Derivation must not mutate the source snapshot');
});

test('startup and full lists avoid large collections; repeated and concurrent loads are cached', async () => {
  const { loader, requests } = loaderFixture();
  await Promise.all([loader.loadCore(), loader.loadCore()]);
  const data = await loader.loadRoute({ page: 'overview' }, 'full');
  assert.deepEqual(data.ballots, []);
  assert.deepEqual(data.speeches, []);
  assert.deepEqual(data.votes[0].committees, committeeIndex.matters['HE 1/2026 vp']);
  await loader.loadRoute({ page: 'votes' }, 'full');
  await loader.loadRoute({ page: 'members' }, 'full');
  assert.deepEqual(requests, ['./data/parliament/core.json']);
  const member = await loader.loadRoute({ page: 'members', id: '1' }, 'full');
  assert.equal(member.ballots.length, 2);
  assert.equal(member.ballots[0].firstName, 'A');
  assert.deepEqual(member.speeches, [fixture().speeches[0]]);
  assert.equal(loader.routeReady({ page: 'members', id: '1' }, 'full'), true);
  await loader.loadRoute({ page: 'members', id: '1' }, 'simple');
  assert.equal(requests.length, 2);
  const overview = await loader.loadRoute({ page: 'overview' }, 'simple');
  assert.deepEqual(overview.ballots, [], 'Scoped data must not leak to another route');
});

test('a debate-only session loads only its own speech metadata in either reading view', async () => {
  const { loader, requests } = loaderFixture();
  const session = await loader.loadRoute({page:'sessions',id:'2026-96'},'full');
  assert.deepEqual(session.speeches,[fixture().speeches[0]]);
  assert.equal(loader.routeReady({page:'sessions',id:'2026-96'},'simple'),true);
  assert.deepEqual(session.ballots,[]);
  await loader.loadRoute({page:'sessions',id:'2026-96'},'simple');
  assert.equal(requests.length,2);
  assert.match(requests[1],/session-0.json/);
  const other = await loader.loadRoute({page:'sessions',id:'2026-94'},'simple');
  assert.deepEqual(other.speeches,[fixture().speeches[1]]);
  const missing = await loader.loadRoute({page:'sessions',id:'missing'},'full');
  assert.deepEqual(missing.speeches,[]);
  assert.equal(requests.length,3);
});

test('simple party filters load aggregates and unknown detail links request no shards', async () => {
  const { loader, requests } = loaderFixture();
  const list = await loader.loadRoute({ page: 'votes' }, 'simple');
  assert.equal(list.partyVotes.v1.sd.no, 1);
  assert.deepEqual(list.ballots, []);
  assert.equal(requests.length, 2);
  const missing = await loader.loadRoute({ page: 'votes', id: '../../missing' }, 'full');
  assert.deepEqual(missing.ballots, []);
  assert.equal(requests.length, 2);
  assert.deepEqual(await loader.loadSpeeches(), fixture().speeches);
});

test('failed requests can retry and mixed source snapshots are rejected', async () => {
  const chunks = parliamentChunks(fixture());
  let attempts = 0;
  const loader = createParliamentLoader(async url => {
    const name = url.split('/').at(-1).split('?')[0];
    if (name === 'core.json') return structuredClone(chunks.get(name));
    attempts++;
    if (attempts === 1) throw new Error('Offline');
    const value = structuredClone(chunks.get(name));
    if (attempts === 2) value.snapshot = 'older snapshot';
    return value;
  });
  await assert.rejects(loader.loadSpeeches(), /Offline/);
  await assert.rejects(loader.loadSpeeches(), /updated/);
  assert.deepEqual(await loader.loadSpeeches(), fixture().speeches);
  assert.equal(attempts, 3);
});

test('a retry cannot be overwritten by an older in-flight snapshot', async () => {
  let resolveOld, calls = 0;
  const oldCore = parliamentChunks(fixture()).get('core.json');
  const newCore = structuredClone(oldCore);
  newCore.metadata.generatedAt = '2026-10-12T12:00:00Z';
  const loader = createParliamentLoader(() => {
    if (++calls === 1) return new Promise(resolve => { resolveOld = resolve; });
    return Promise.resolve(newCore);
  });
  const old = loader.loadCore();
  await Promise.resolve();
  loader.clear();
  assert.equal((await loader.loadCore()).metadata.generatedAt, newCore.metadata.generatedAt);
  resolveOld(oldCore);
  await assert.rejects(old, /superseded/);
  assert.equal((await loader.loadCore()).metadata.generatedAt, newCore.metadata.generatedAt);
  assert.equal(calls, 2);
});

test('JSON cache policy can revalidate the small entry point without disabling payload caching', async () => {
  const { fetchJSONWithTimeout } = await import('../app-utils.js');
  let policy;
  await fetchJSONWithTimeout('/core.json', { cache: 'no-cache', fetchImpl: async (url, options) => {
    policy = options.cache;
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ ready: true }) };
  } });
  assert.equal(policy, 'no-cache');
});
