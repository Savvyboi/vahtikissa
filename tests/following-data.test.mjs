import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createParliamentLoader } from '../parliament-data.js';
import { parliamentChunks } from '../scripts/build-parliament-data.mjs';
import { emptyInsights, sourceFingerprint } from '../ai-insights.js';
import { clearFollowingDataCache, loadFollowingData, lobbyingMemberIds, themeRecords } from '../following-data.js';

const generatedAt = '2026-10-20T12:00:00Z';
function fixture() {
  const data = {
    metadata: { generatedAt, counts: { votes: 2, legislation: 1 } },
    votes: [{ id: 'v1', title: 'Vote one', date: '2026-10-01', resultUrl: 'https://example.org/v1' }, { id: 'v2', title: 'Vote two', date: '2026-10-02' }],
    members: [{ id: '1', firstName: 'Aino', lastName: 'Yksi', stats: { votes: 1, speeches: 1 } }, { id: '2', firstName: 'Matti', lastName: 'Kaksi', stats: { votes: 1, speeches: 0 } }],
    ballots: [['v1', '1', 'sd', 'yes'], ['v2', '2', 'kok', 'no']],
    speeches: [{ id: 's1', mpId: '1', agenda: 'Speech title', date: '2026-09-01', session: 'session1', url: 'https://example.org/s1' }],
    legislation: [{ id: 'HE 1/2026 vp', title: 'Law one', latestDate: '2026-10-03', voteIds: ['v1'], url: 'https://example.org/law' }],
    parties: [], sessions: [{ id: 'session1', voteIds: ['v1'] }]
  };
  const chunks = parliamentChunks(data), requests = [];
  const loader = createParliamentLoader(async url => {
    requests.push(url);
    const value = chunks.get(url.split('/').at(-1).split('?')[0]);
    if (value instanceof Error) throw value;
    return structuredClone(value);
  });
  const aiIndex = emptyInsights(); aiIndex.generatedAt = '2026-10-21T12:00:00Z';
  aiIndex.programmes.p1 = { id: 'p1', tags: [{ id: 'education', label: { fi: 'Koulutus' } }] };
  aiIndex.records.votes.v1 = { fingerprint: sourceFingerprint('votes', data.votes[0]), tags: ['education'] };
  aiIndex.records.legislation[data.legislation[0].id] = { fingerprint: sourceFingerprint('legislation', data.legislation[0]), tags: ['education'] };
  return { data, chunks, requests, loader, aiIndex };
}

test('Following fetches only selected member shards, retaining record IDs, dates and source links', async () => {
  const { loader, requests } = fixture(), core = await loader.loadCore();
  assert.deepEqual(await loadFollowingData({ parliamentLoader: loader, core }), []);
  assert.equal(requests.length, 1);
  const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1', '1'] });
  assert.deepEqual(sources.map(item => item.key), ['mp:1:votes', 'mp:1:speeches']);
  assert.ok(sources.every(item => item.complete && item.snapshot === generatedAt));
  assert.deepEqual(sources[0].records[0], { id: 'v1', kind: 'votes', title: 'Vote one', titleSv: '', date: '2026-10-01', url: 'https://example.org/v1', href: '#/votes/v1', memberIds: ['1'], themeIds: [], choice: 'yes' });
  assert.equal(sources[1].records[0].id, 's1');
  assert.equal(sources[1].records[0].date, '2026-09-01');
  assert.deepEqual(requests.map(url => url.split('?')[0]), ['./data/parliament/core.json', './data/parliament/member-0.json']);
});

test('Theme sources use fingerprint-valid AI associations and independently load proposals', async () => {
  const { data, loader, aiIndex, requests } = fixture(), core = await loader.loadCore();
  const sources = await loadFollowingData({ parliamentLoader: loader, core, themes: ['education'], aiIndex });
  assert.deepEqual(sources.map(item => [item.key, item.records.map(record => record.id)]), [
    ['theme:education:votes', ['v1']], ['theme:education:legislation', ['HE 1/2026 vp']]
  ]);
  assert.equal(sources[0].aiGeneratedAt, aiIndex.generatedAt);
  assert.match(sources[0].snapshot, /AI 2026-10-21/);
  assert.equal(sources[1].records[0].url, data.legislation[0].url);
  assert.ok(requests.some(url => /legislation.json/.test(url)));
  const changed = { ...data.votes[0], title: 'Corrected source title' };
  assert.deepEqual(themeRecords('votes', [changed], aiIndex, 'education'), []);
});

test('Unknown and unavailable themes never form an empty successful baseline', async () => {
  const { loader, aiIndex } = fixture(), core = await loader.loadCore();
  for (const index of [null, aiIndex]) {
    const sources = await loadFollowingData({ parliamentLoader: loader, core, themes: [index ? 'removed-theme' : 'education'], aiIndex: index });
    assert.equal(sources.length, 2);
    assert.ok(sources.every(item => !item.complete && item.error));
  }
});

test('Malformed AI structures fail only theme sources while MP activity stays available', async () => {
  const corruptions = [
    index => { index.version = 2; },
    index => { index.generatedAt = null; },
    index => { index.programmes = []; },
    index => { index.programmes.p1 = null; },
    index => { index.programmes.p1.tags = {}; },
    index => { index.programmes.p1.tags = [null]; },
    index => { index.programmes.p1.tags[0].id = {}; },
    index => { index.programmes.p1.tags[0].id = ''; },
    index => { index.records = null; },
    index => { index.records.votes = []; },
    index => { index.records.votes.v1 = null; },
    index => { index.records.votes.v1.tags = {}; },
    index => { index.records.votes.v1.tags = [{}]; },
    index => { index.records.votes.v1.fingerprint = 123; },
    index => { index.records.votes.v1.fingerprint = ''; },
    index => { index.records.legislation = null; },
    index => { index.records.legislation['HE 1/2026 vp'].tags = 'education'; }
  ];
  for (const corrupt of corruptions) {
    const { loader, aiIndex } = fixture(), core = await loader.loadCore();
    corrupt(aiIndex);
    const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1'], themes: ['education'], aiIndex });
    assert.equal(sources.length, 4);
    assert.ok(sources.filter(source => source.memberId).every(source => source.complete), String(corrupt));
    assert.ok(sources.filter(source => source.themeId).every(source => !source.complete && !source.records.length && source.error), String(corrupt));
  }
});

test('A structurally valid partial AI index is usable without implying full analysis coverage', async () => {
  const { loader, aiIndex } = fixture(), core = await loader.loadCore();
  aiIndex.records.votes = {};
  const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1'], themes: ['education'], aiIndex });
  assert.ok(sources.every(source => source.complete));
  assert.deepEqual(sources.find(source => source.themeId && source.kind === 'votes').records, []);
  assert.equal(sources.find(source => source.themeId && source.kind === 'legislation').records.length, 1);
});

test('Missing or malformed core metadata produces unavailable themes without rejecting the feed load', async () => {
  const { loader, aiIndex } = fixture();
  for (const core of [null, {}, { metadata: null }, { metadata: { generatedAt }, members: [], votes: null }]) {
    const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1'], themes: ['education'], aiIndex });
    assert.equal(sources.length, 4);
    assert.ok(sources.every(source => !source.complete && !source.records.length));
  }
});

test('One MP failure does not hide another MP or advance any failed source', async () => {
  const { chunks, loader } = fixture(), core = await loader.loadCore();
  chunks.set('member-0.json', new Error('network failure'));
  const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1', '2', 'removed'] });
  assert.ok(sources.filter(source => source.memberId === '1').every(source => !source.complete && source.records.length === 0));
  assert.ok(sources.filter(source => source.memberId === '2').every(source => source.complete));
  assert.ok(sources.filter(source => source.memberId === 'removed').every(source => !source.complete));
});

test('Mixed, truncated, duplicate and incorrectly associated member shards are rejected', async () => {
  for (const change of [
    shard => { shard.snapshot = '2026-10-19T12:00:00Z'; },
    shard => { shard.speeches = []; },
    shard => { delete shard.ballots; },
    shard => { shard.ballots.push(shard.ballots[0]); },
    shard => { shard.speeches[0].mpId = '2'; },
    shard => { shard.ballots[0][0] = 'missing-vote'; }
  ]) {
    const { chunks, loader } = fixture(), core = await loader.loadCore();
    change(chunks.get('member-0.json'));
    const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1'] });
    assert.ok(sources.every(source => !source.complete), String(change));
  }
});

test('Malformed typed source IDs and MP associations never become successful snapshots', async () => {
  const invalidIds = [{}, [], true, null, NaN, Infinity, '', '   ', 'bad\u0000id'];
  for (const invalid of invalidIds) {
    for (const change of [
      (core, chunks) => { core.votes[0].id = invalid; },
      (core, chunks) => { core.members[0].id = invalid; },
      (core, chunks) => { chunks.get('member-0.json').ballots[0][0] = invalid; },
      (core, chunks) => { chunks.get('member-0.json').ballots[0][1] = invalid; },
      (core, chunks) => { chunks.get('member-0.json').speeches[0].id = invalid; },
      (core, chunks) => { chunks.get('member-0.json').speeches[0].mpId = invalid; }
    ]) {
      const { chunks, loader } = fixture(), core = await loader.loadCore();
      change(core, chunks);
      const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1'] });
      assert.equal(sources.length, 2);
      assert.ok(sources.every(source => !source.complete && source.records.length === 0), String(change));
    }
  }
});

test('Numeric MP IDs retain their canonical identity; numeric source-record IDs are rejected', async () => {
  const { loader, chunks } = fixture(), core = await loader.loadCore();
  core.members[0].id = 1;
  chunks.get('member-0.json').ballots[0][1] = 1;
  chunks.get('member-0.json').speeches[0].mpId = 1;
  const sources = await loadFollowingData({ parliamentLoader: loader, core, members: [1] });
  assert.ok(sources.every(source => source.complete && source.memberId === '1'));
  const { loader: secondLoader } = fixture(), secondCore = await secondLoader.loadCore();
  secondCore.votes[0].id = 7;
  const rejected = await loadFollowingData({ parliamentLoader: secondLoader, core: secondCore, members: ['1'] });
  assert.ok(rejected.every(source => !source.complete));
});

test('Invalid typed proposal IDs fail the proposal source without forming an empty baseline', async () => {
  for (const invalid of [{}, [], true, null, 1]) {
    const { loader, chunks, aiIndex } = fixture(), core = await loader.loadCore();
    chunks.get('legislation.json').legislation[0].id = invalid;
    const sources = await loadFollowingData({ parliamentLoader: loader, core, themes: ['education'], aiIndex });
    assert.equal(sources.find(source => source.kind === 'votes').complete, true);
    assert.equal(sources.find(source => source.kind === 'legislation').complete, false);
  }
});

test('A failed proposal snapshot leaves successful theme votes available', async () => {
  const { loader, chunks, aiIndex } = fixture(), core = await loader.loadCore();
  chunks.get('legislation.json').legislation = [];
  const sources = await loadFollowingData({ parliamentLoader: loader, core, themes: ['education'], aiIndex });
  assert.equal(sources.find(source => source.kind === 'votes').complete, true);
  assert.equal(sources.find(source => source.kind === 'legislation').complete, false);
});

function civicFixture() {
  return {
    metadata: { generatedAt: '2026-10-22T08:00:00Z', parliamentSource: 'https://example.org/gifts', transparencySource: 'https://example.org/lobbying' },
    counts: { gifts: 1, lobbyingTopics: 1 },
    gifts: [{ id: 'gift1', mpId: '1', reported: '1.9.2026', description: 'Book', donor: 'Library', used: 'Earlier' }],
    targets: [{ id: 42, kind: 'mp', fi: { name: 'Aino Yksi' } }],
    lobbying: [{ id: 'notification-topic1', notificationId: 123, actor: 'Organisation', topic: 'School funding', reported: '2026-10-05', targetIds: [42], period: { start: '2026-01-01', end: '2026-06-30' } }]
  };
}

test('Gifts and lobbying are opt-in, source-specific, and preserve disclosure dates and stable IDs', async () => {
  clearFollowingDataCache();
  const { loader } = fixture(), core = await loader.loadCore();
  let calls = 0;
  const fetchJSON = async () => { calls++; return civicFixture(); };
  await loadFollowingData({ parliamentLoader: loader, core, members: ['1'], fetchJSON });
  assert.equal(calls, 0, 'Unrelated routes and normal Following do not download the large civic dataset');
  const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1'], fetchJSON, includeInfluence: true });
  const gift = sources.find(source => source.kind === 'gifts'), lobbying = sources.find(source => source.kind === 'lobbying');
  assert.equal(gift.generatedAt, '2026-10-22T08:00:00Z');
  assert.equal(gift.records[0].date, '2026-09-01');
  assert.equal(gift.records[0].id, 'gift1');
  assert.equal(gift.records[0].url, 'https://example.org/gifts');
  assert.equal(lobbying.coverage, 'unique-name');
  assert.equal(lobbying.records[0].id, 'notification-topic1');
  assert.deepEqual(lobbying.records[0].period, { start: '2026-01-01', end: '2026-06-30' });
  await loadFollowingData({ parliamentLoader: loader, core, members: ['1'], fetchJSON, includeInfluence: true });
  assert.equal(calls, 1);
  clearFollowingDataCache();
});

test('Lobbying name associations require one exact MP name and never include assistants', () => {
  const members = [{ id: '1', firstName: 'Aino', lastName: 'Yksi' }, { id: '2', firstName: 'Matti', lastName: 'Kaksi' }];
  const targets = new Map([
    ['1', { kind: 'mp', fi: { name: '  AINO  YKSI  ' } }],
    ['2', { kind: 'assistant', fi: { name: 'Aino Yksi' } }],
    ['3', { kind: 'mp', fi: { name: 'Aino' } }]
  ]);
  assert.deepEqual(lobbyingMemberIds({ targetIds: [1, 2, 3] }, targets, members), ['1']);
  assert.deepEqual(lobbyingMemberIds({ targetIds: [1] }, targets, [...members, { ...members[0], id: '3' }]), []);
});

test('Failed or incomplete civic loads are not successful empty snapshots and can retry', async () => {
  clearFollowingDataCache();
  const { loader } = fixture(), core = await loader.loadCore();
  let calls = 0;
  const fetchJSON = async () => { calls++; if (calls === 1) throw new Error('Blocked'); const civic = civicFixture(); if (calls === 2) civic.targets = []; return civic; };
  for (let i = 0; i < 2; i++) {
    const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1'], fetchJSON, includeInfluence: true });
    assert.ok(sources.filter(source => ['gifts', 'lobbying'].includes(source.kind)).every(source => !source.complete));
  }
  const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1'], fetchJSON, includeInfluence: true });
  assert.ok(sources.every(source => source.complete));
  assert.equal(calls, 3);
  clearFollowingDataCache();
});

test('Civic record IDs, numeric target IDs and MP links are validated before coercion', async () => {
  for (const invalid of [{}, [], true, null, NaN, Infinity, '', '   ']) {
    for (const change of [
      civic => { civic.gifts[0].id = invalid; },
      civic => { civic.gifts[0].mpId = invalid; },
      civic => { civic.lobbying[0].id = invalid; },
      civic => { civic.targets[0].id = invalid; civic.lobbying[0].targetIds = [invalid]; },
      civic => { civic.lobbying[0].targetIds = [invalid]; }
    ]) {
      clearFollowingDataCache();
      const { loader } = fixture(), core = await loader.loadCore(), civic = civicFixture();
      change(civic);
      const sources = await loadFollowingData({ parliamentLoader: loader, core, members: ['1'], includeInfluence: true, fetchJSON: async () => civic });
      assert.ok(sources.filter(source => ['gifts', 'lobbying'].includes(source.kind)).every(source => !source.complete && !source.records.length), String(change));
    }
  }
  clearFollowingDataCache();
  const { loader } = fixture(), core = await loader.loadCore(), civic = civicFixture();
  civic.gifts[0].mpId = 1;
  const valid = await loadFollowingData({ parliamentLoader: loader, core, members: ['1'], includeInfluence: true, fetchJSON: async () => civic });
  assert.ok(valid.every(source => source.complete));
  assert.equal(valid.find(source => source.kind === 'gifts').records[0].memberIds[0], '1');
  clearFollowingDataCache();
});

test('Tracked Parliament snapshot and derived MP shards match the following loader contract', async () => {
  // Generated parliament/ files are ignored and may not exist on a clean checkout.
  const raw = JSON.parse(await readFile(new URL('../data/parliament.json', import.meta.url)));
  const chunks = parliamentChunks(raw);
  const loader = createParliamentLoader(async url => structuredClone(chunks.get(url.split('/').at(-1).split('?')[0])));
  const core = await loader.loadCore(), member = core.members[0];
  const sources = await loadFollowingData({ parliamentLoader: loader, core, members: [member.id] });
  assert.ok(sources.every(source => source.complete));
  assert.equal(sources.find(source => source.kind === 'votes').records.length, member.stats.votes);
  assert.equal(sources.find(source => source.kind === 'speeches').records.length, member.stats.speeches);
});
