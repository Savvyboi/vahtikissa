// Browser-local preferences only. This module never contacts a server.
export const FOLLOWING_VERSION = 1;
export const FOLLOWING_IMPORT_MAX_BYTES = 65_536;
export const FOLLOWING_KEYS = Object.freeze({ members: 'vahtikissa-followed-members', tags: 'vahtikissa-ai-tags', snapshots: 'vahtikissa-following-snapshots' });
const MAX_SELECTIONS = 1000, MAX_SOURCE_IDS = 100_000;
const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 180 && !/[\u0000-\u001f\u007f]/u.test(id);
const validIds = (ids, max = MAX_SELECTIONS) => Array.isArray(ids) && ids.length <= max && ids.every(validId);
const unique = ids => [...new Set(ids)];
const browserStorage = () => globalThis.localStorage;
const defaultNow = () => new Date().toISOString();
const byteLength = text => new TextEncoder().encode(text).length;

export function createFollowingStore({ storage = browserStorage } = {}) {
  let error = null, writeError = null;
  const getStorage = () => typeof storage === 'function' ? storage() : storage;
  function read() {
    let target;
    try { target = getStorage(); if (!target) throw new Error('Unavailable storage'); } catch { error = 'storage'; return { members: [], tags: [] }; }
    const result = { members: [], tags: [] };
    let readError = null;
    for (const kind of ['members', 'tags']) {
      try {
        const raw = target.getItem(FOLLOWING_KEYS[kind]);
        if (raw === null) continue;
        const ids = JSON.parse(raw);
        if (!validIds(ids)) throw new Error('Corrupt selections');
        result[kind] = unique(ids);
      } catch (cause) { readError = cause instanceof SyntaxError || cause.message === 'Corrupt selections' ? 'corrupt' : 'storage'; }
    }
    error = readError;
    return result;
  }
  function replace(value) {
    if (!value || !validIds(value.members) || !validIds(value.tags)) return { ok: false, saved: false, code: 'invalid' };
    const desired = { members: unique(value.members), tags: unique(value.tags) };
    let target, originals;
    const written = [];
    try {
      target = getStorage();
      originals = Object.fromEntries(['members', 'tags'].map(kind => [kind, target.getItem(FOLLOWING_KEYS[kind])]));
      for (const kind of ['members', 'tags']) {
        const raw = JSON.stringify(desired[kind]);
        if (originals[kind] === raw) continue;
        target.setItem(FOLLOWING_KEYS[kind], raw);
        written.push(kind);
      }
      error = null;
      writeError = null;
      return { ok: true, saved: true };
    } catch {
      let rollbackFailed = false;
      for (const kind of written.reverse()) {
        try {
          if (originals[kind] === null) target.removeItem(FOLLOWING_KEYS[kind]);
          else target.setItem(FOLLOWING_KEYS[kind], originals[kind]);
        } catch { rollbackFailed = true; }
      }
      error = 'storage';
      writeError = 'storage';
      return { ok: false, saved: false, code: 'storage', rollbackFailed };
    }
  }
  function toggle(kind, id) {
    if (!validId(id)) return { ok: false, saved: false, code: 'invalid' };
    const value = read();
    // A corrupt category must be repaired explicitly through clear/import. Do not
    // accidentally discard unreadable saved selections by toggling one item.
    if (error) return { ok: false, saved: false, code: error };
    value[kind] = value[kind].includes(id) ? value[kind].filter(item => item !== id) : [...value[kind], id];
    return replace(value);
  }
  return {
    selections: read,
    status() { read(); const reason = error || writeError; return { persistent: !reason, error: reason }; },
    toggleMember: id => toggle('members', String(id)),
    toggleTag: id => toggle('tags', id),
    replace,
    clear: () => replace({ members: [], tags: [] }),
    exportJSON() {
      const selections = read();
      return JSON.stringify({ type: 'vahtikissa-following', version: FOLLOWING_VERSION, ...selections }, null, 2) + '\n';
    },
    importJSON(text, { memberIds, tagIds } = {}) {
      if (typeof text !== 'string') return { ok: false, saved: false, code: 'invalid' };
      if (text.length > FOLLOWING_IMPORT_MAX_BYTES || byteLength(text) > FOLLOWING_IMPORT_MAX_BYTES) return { ok: false, saved: false, code: 'oversized' };
      let value;
      try { value = JSON.parse(text); } catch { return { ok: false, saved: false, code: 'invalid' }; }
      if (!value || value.type !== 'vahtikissa-following' || value.version !== FOLLOWING_VERSION) return { ok: false, saved: false, code: 'version' };
      if (!validIds(value.members) || !validIds(value.tags) || Object.keys(value).some(key => !['type', 'version', 'members', 'tags'].includes(key))) return { ok: false, saved: false, code: 'invalid' };
      if (!memberIds || !tagIds) return { ok: false, saved: false, code: 'catalog' };
      const members = new Set([...memberIds].map(String)), tags = new Set(tagIds);
      const unknown = { members: unique(value.members.filter(id => !members.has(id))), tags: unique(value.tags.filter(id => !tags.has(id))) };
      if (unknown.members.length || unknown.tags.length) return { ok: false, saved: false, code: 'unknown-ids', unknown };
      return replace(value);
    }
  };
}

// A visit is one loaded document. A source's comparison baseline is frozen at
// its first successful complete load in that document, across every rerender.
// Source-specific histories are independent; a failed source never advances.
export function createSnapshotTracker({ storage = browserStorage, now = defaultNow } = {}) {
  const visits = new Map();
  const getStorage = () => typeof storage === 'function' ? storage() : storage;
  function readHistory() {
    try {
      const target = getStorage();
      if (!target) throw new Error('Unavailable storage');
      const raw = target.getItem(FOLLOWING_KEYS.snapshots);
      if (raw === null) return { history: { version: 1, sources: {} }, error: null };
      const history = JSON.parse(raw);
      if (history?.version !== 1 || !history.sources || typeof history.sources !== 'object' || Array.isArray(history.sources)) throw new SyntaxError('Invalid history');
      for (const [source, value] of Object.entries(history.sources)) {
        if (!validId(source) || !validIds(value?.ids, MAX_SOURCE_IDS) || typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt)) || typeof value.snapshot !== 'string') throw new SyntaxError('Invalid history');
      }
      return { history, error: null };
    } catch (cause) { return { history: { version: 1, sources: {} }, error: cause instanceof SyntaxError ? 'corrupt' : 'storage' }; }
  }
  return {
    observe(source, { ids, snapshot, complete = false } = {}) {
      if (!complete || !validId(source) || !validIds(ids, MAX_SOURCE_IDS) || new Set(ids).size !== ids.length || typeof snapshot !== 'string' || !snapshot.length || snapshot.length > 180) return { ok: false, saved: false, error: 'incomplete', newIds: new Set() };
      const { history, error: readError } = readHistory();
      if (!visits.has(source)) {
        const previous = Object.hasOwn(history.sources, source) ? history.sources[source] : null;
        visits.set(source, { baseline: new Set(previous?.ids || ids), previousObservedAt: previous?.observedAt || null, firstVisit: !previous, firstObserved: new Map(), seen: new Set(previous?.ids || ids), currentIds: null, snapshot: null, observedAt: null, saved: false, error: null });
      }
      const visit = visits.get(source);
      const unchanged = visit.snapshot === snapshot && visit.currentIds?.size === ids.length && ids.every(id => visit.currentIds.has(id));
      const currentTime = unchanged ? visit.observedAt : now();
      if (!Number.isFinite(Date.parse(currentTime))) throw new Error('Invalid observation clock');
      const newIds = new Set(ids.filter(id => !visit.baseline.has(id)));
      for (const id of newIds) if (!visit.firstObserved.has(id)) visit.firstObserved.set(id, currentTime);
      for (const id of ids) visit.seen.add(id);
      // Keep identities observed earlier as well: source removals and later
      // reappearances must not masquerade as first-observed records.
      const previousIds = Object.hasOwn(history.sources, source) ? history.sources[source].ids : [];
      const merged = new Set([...previousIds, ...visit.seen]);
      let saved = unchanged && visit.saved, error = saved ? visit.error : readError;
      if (!saved && merged.size <= MAX_SOURCE_IDS && readError !== 'storage') {
        Object.defineProperty(history.sources, source, { value: { ids: [...merged], snapshot, observedAt: currentTime }, enumerable: true, configurable: true, writable: true });
        try { getStorage().setItem(FOLLOWING_KEYS.snapshots, JSON.stringify(history)); saved = true; error = null; }
        catch { error = 'storage'; }
      } else if (merged.size > MAX_SOURCE_IDS) error = 'capacity';
      visit.currentIds = new Set(ids); visit.snapshot = snapshot; visit.observedAt = currentTime; visit.saved = saved; visit.error = error;
      return { ok: true, saved, error, firstVisit: visit.firstVisit, newIds, firstObserved: new Map(visit.firstObserved), observedAt: currentTime, previousObservedAt: visit.previousObservedAt, snapshot };
    }
  };
}

export const followingStore = createFollowingStore();
export const followingSnapshots = createSnapshotTracker();
