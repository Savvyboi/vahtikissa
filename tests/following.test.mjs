import test from 'node:test';
import assert from 'node:assert/strict';
import { createFollowingStore, createSnapshotTracker, FOLLOWING_KEYS, FOLLOWING_IMPORT_MAX_BYTES } from '../following-store.js';

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
const exportFile = (members = ['1504'], tags = ['education']) => JSON.stringify({ type: 'vahtikissa-following', version: 1, members, tags });
const catalogs = { memberIds: new Set(['1504', '2059']), tagIds: new Set(['education', 'health']) };
const snapshot = ids => ({ ids, snapshot: '2026-10-20T16:41:01.472Z', complete: true });

test('MP following shares legacy theme selections and persists across fresh stores', () => {
  const storage = new MemoryStorage();
  storage.setItem(FOLLOWING_KEYS.tags, '["education","education"]');
  const first = createFollowingStore({ storage });
  assert.deepEqual(first.selections(), { members: [], tags: ['education'] });
  assert.deepEqual(first.toggleMember(1504), { ok: true, saved: true });
  assert.deepEqual(createFollowingStore({ storage }).selections(), { members: ['1504'], tags: ['education'] });
  first.toggleTag('health');
  assert.deepEqual(JSON.parse(storage.getItem('vahtikissa-ai-tags')), ['education', 'health']);
  first.toggleMember('1504');
  assert.deepEqual(first.selections().members, []);
  // An existing theme control or a different tab writes the same legacy key.
  storage.setItem(FOLLOWING_KEYS.tags, '["health"]');
  assert.deepEqual(first.selections().tags, ['health']);
});

test('export contains only versioned selections, and import validates IDs before replacing', () => {
  const storage = new MemoryStorage(), store = createFollowingStore({ storage });
  storage.setItem('unrelated-private-value', 'do not export');
  storage.setItem(FOLLOWING_KEYS.snapshots, '{"browsing":"history"}');
  assert.equal(store.importJSON(exportFile(), catalogs).ok, true);
  assert.deepEqual(JSON.parse(store.exportJSON()), { type: 'vahtikissa-following', version: 1, members: ['1504'], tags: ['education'] });
  const before = store.selections();
  const unknown = store.importJSON(exportFile(['removed-member'], ['education']), catalogs);
  assert.equal(unknown.code, 'unknown-ids');
  assert.deepEqual(unknown.unknown.members, ['removed-member']);
  assert.deepEqual(store.selections(), before);
  assert.equal(store.importJSON(exportFile(['2059'], []), catalogs).ok, true);
  assert.deepEqual(store.selections(), { members: ['2059'], tags: [] });
  assert.equal(storage.getItem('unrelated-private-value'), 'do not export');
});

test('malformed, incompatible, oversized and unexpected import fields preserve all selections', () => {
  const storage = new MemoryStorage(), store = createFollowingStore({ storage });
  store.importJSON(exportFile(), catalogs);
  const before = store.exportJSON();
  for (const [input, code] of [
    ['{', 'invalid'], ['null', 'version'], [exportFile().replace('"version":1', '"version":2'), 'version'],
    [JSON.stringify({ type: 'vahtikissa-following', version: 1, members: [1504], tags: [] }), 'invalid'],
    [JSON.stringify({ ...JSON.parse(exportFile()), history: [] }), 'invalid'],
    [' '.repeat(FOLLOWING_IMPORT_MAX_BYTES + 1), 'oversized'],
    ['ä'.repeat(FOLLOWING_IMPORT_MAX_BYTES / 2 + 1), 'oversized']
  ]) {
    assert.equal(store.importJSON(input, catalogs).code, code);
    assert.equal(store.exportJSON(), before);
  }
  assert.equal(store.importJSON(exportFile()).code, 'catalog');
});

test('failed two-key import rolls back and reports failure even after reading selections', () => {
  const storage = new MemoryStorage(), store = createFollowingStore({ storage });
  store.importJSON(exportFile(), catalogs);
  const normalSet = storage.setItem.bind(storage);
  let failed = false;
  storage.setItem = (key, value) => {
    if (key === FOLLOWING_KEYS.tags && !failed) { failed = true; throw new Error('QuotaExceededError'); }
    normalSet(key, value);
  };
  const result = store.importJSON(exportFile(['2059'], ['health']), catalogs);
  assert.equal(result.ok, false);
  assert.equal(result.rollbackFailed, false);
  assert.deepEqual(store.selections(), { members: ['1504'], tags: ['education'] });
  assert.deepEqual(store.status(), { persistent: false, error: 'storage' });
  assert.equal(store.toggleMember('2059').saved, true);
  assert.equal(store.status().persistent, true);
});

test('blocked, unavailable, full and corrupt browser storage do not throw or falsely save', () => {
  for (const storage of [undefined, { getItem() { throw new Error('SecurityError'); } }]) {
    const store = createFollowingStore({ storage: () => storage });
    assert.deepEqual(store.selections(), { members: [], tags: [] });
    assert.equal(store.toggleMember('1504').saved, false);
    assert.equal(store.status().persistent, false);
  }
  const storage = new MemoryStorage(), store = createFollowingStore({ storage });
  storage.setItem(FOLLOWING_KEYS.members, '["1504"]');
  storage.setItem(FOLLOWING_KEYS.tags, '{corrupt');
  assert.deepEqual(store.selections(), { members: ['1504'], tags: [] });
  assert.equal(store.toggleMember('2059').code, 'corrupt');
  assert.equal(storage.getItem(FOLLOWING_KEYS.tags), '{corrupt');
  assert.equal(store.clear().saved, true);
  assert.deepEqual(store.selections(), { members: [], tags: [] });
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(store.toggleMember('1504').saved, false);
  assert.deepEqual(store.selections().members, []);
});

test('first complete load seeds a baseline without marking history new; later additions are new', () => {
  const storage = new MemoryStorage();
  let time = '2026-10-21T12:00:00Z';
  const tracker = createSnapshotTracker({ storage, now: () => time });
  const first = tracker.observe('member:1504:speeches', snapshot(['old-1', 'old-2']));
  assert.equal(first.firstVisit, true);
  assert.equal(first.previousObservedAt, null);
  assert.deepEqual([...first.newIds], []);
  time = '2026-10-21T13:00:00Z';
  const refresh = tracker.observe('member:1504:speeches', snapshot(['old-1', 'old-2', 'backfill-1999']));
  assert.deepEqual([...refresh.newIds], ['backfill-1999']);
  assert.equal(refresh.firstObserved.get('backfill-1999'), time);
  assert.equal(refresh.snapshot, '2026-10-20T16:41:01.472Z');
  // The source snapshot/event timestamp does not become the observation time.
  assert.notEqual(refresh.firstObserved.get('backfill-1999'), refresh.snapshot);
});

test('repeat visit compares source IDs to last successful observation, preserving badges on rerender', () => {
  const storage = new MemoryStorage();
  createSnapshotTracker({ storage, now: () => '2026-10-21T12:00:00Z' }).observe('votes', snapshot(['v1']));
  let time = '2026-10-22T12:00:00Z';
  const tracker = createSnapshotTracker({ storage, now: () => time });
  const firstRender = tracker.observe('votes', snapshot(['v1', 'v2']));
  assert.equal(firstRender.firstVisit, false);
  assert.equal(firstRender.previousObservedAt, '2026-10-21T12:00:00Z');
  assert.deepEqual([...firstRender.newIds], ['v2']);
  time = '2026-10-22T13:00:00Z';
  const rerender = tracker.observe('votes', snapshot(['v1', 'v2', 'v3']));
  assert.deepEqual([...rerender.newIds], ['v2', 'v3']);
  assert.equal(rerender.firstObserved.get('v2'), '2026-10-22T12:00:00Z');
  assert.equal(rerender.previousObservedAt, firstRender.previousObservedAt);
  time = '2026-10-22T14:00:00Z';
  const storedBefore = storage.getItem(FOLLOWING_KEYS.snapshots);
  const sameSnapshot = tracker.observe('votes', snapshot(['v3', 'v1', 'v2']));
  assert.equal(sameSnapshot.observedAt, '2026-10-22T13:00:00Z');
  assert.equal(sameSnapshot.firstObserved.get('v2'), '2026-10-22T12:00:00Z');
  assert.equal(storage.getItem(FOLLOWING_KEYS.snapshots), storedBefore);
  assert.deepEqual([...createSnapshotTracker({ storage }).observe('votes', snapshot(['v1', 'v2', 'v3'])).newIds], []);
});

test('incomplete or invalid snapshots never advance baselines, and sources refresh independently', () => {
  const storage = new MemoryStorage();
  const first = createSnapshotTracker({ storage });
  first.observe('votes', snapshot(['v1']));
  first.observe('speeches', snapshot(['s1']));
  const before = storage.getItem(FOLLOWING_KEYS.snapshots);
  const later = createSnapshotTracker({ storage });
  for (const value of [{ ...snapshot(['v1', 'v2']), complete: false }, snapshot(['v1', 'v1']), snapshot([null]), { ids: [], complete: true }]) {
    assert.equal(later.observe('votes', value).ok, false);
    assert.equal(storage.getItem(FOLLOWING_KEYS.snapshots), before);
  }
  assert.deepEqual([...later.observe('votes', snapshot(['v1', 'v2'])).newIds], ['v2']);
  const next = createSnapshotTracker({ storage });
  assert.deepEqual([...next.observe('votes', snapshot(['v1', 'v2'])).newIds], []);
  assert.deepEqual([...next.observe('speeches', snapshot(['s1', 's2'])).newIds], ['s2']);
});

test('source removals and reappearances are not first observations; unseen backfills are', () => {
  const storage = new MemoryStorage();
  createSnapshotTracker({ storage }).observe('legislation', snapshot(['old', 'removed']));
  createSnapshotTracker({ storage }).observe('legislation', snapshot(['old']));
  const result = createSnapshotTracker({ storage }).observe('legislation', snapshot(['old', 'removed', 'historical-backfill']));
  assert.deepEqual([...result.newIds], ['historical-backfill']);
});

test('failed snapshot writes preserve the previous visit; corrupt history safely starts over', () => {
  const storage = new MemoryStorage();
  createSnapshotTracker({ storage }).observe('votes', snapshot(['v1']));
  const before = storage.getItem(FOLLOWING_KEYS.snapshots), normalSet = storage.setItem.bind(storage);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const failed = createSnapshotTracker({ storage }).observe('votes', snapshot(['v1', 'v2']));
  assert.equal(failed.saved, false);
  assert.equal(failed.error, 'storage');
  assert.deepEqual([...failed.newIds], ['v2']);
  assert.equal(storage.getItem(FOLLOWING_KEYS.snapshots), before);
  storage.setItem = normalSet;
  assert.deepEqual([...createSnapshotTracker({ storage }).observe('votes', snapshot(['v1', 'v2'])).newIds], ['v2']);
  storage.setItem(FOLLOWING_KEYS.snapshots, '{corrupt');
  const recovered = createSnapshotTracker({ storage }).observe('votes', snapshot(['v1', 'v2']));
  assert.equal(recovered.firstVisit, true);
  assert.equal(recovered.saved, true);
  assert.deepEqual([...recovered.newIds], []);
  assert.equal(JSON.parse(storage.getItem(FOLLOWING_KEYS.snapshots)).version, 1);
});
